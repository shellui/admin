import '@react-email/editor/themes/default.css';
import { EmailEditor, type EmailEditorRef } from '@react-email/editor';
import { Loader2 } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/contexts/ThemeContext';
import {
  parseEmailDocumentJson,
  resolveEmailEditorContent,
  type ActionEmailLang,
} from '@/lib/actionEmailDefaults';
import { formatDocumentAsReactDebugSource } from '@/lib/actionEmailDocumentDebug';
import {
  actionEmailThemeInput,
  availableThemeNamesKey,
  getAppearanceAvailableThemes,
  resolveEmailThemeName,
} from '@/lib/actionEmailTheme';
import type { ActionEmailDocument } from '@/features/actions/emailDocument';
import type { ActionEmailTemplate, ActionTemplateVariable } from '@/features/actions/types';
import { cn } from '@/lib/utils';

type LangTab = ActionEmailLang;
type BodySourceMode = 'visual' | 'json' | 'react';
type PreviewDisplayMode = 'preview' | 'raw';

export type ReactEmailActionEditorHandle = {
  compileAll: () => Promise<{ en: ActionEmailTemplate; fr: ActionEmailTemplate }>;
};

type Props = {
  templateVariables?: ActionTemplateVariable[];
  valueEn: ActionEmailTemplate;
  valueFr: ActionEmailTemplate;
  onChangeEn: (next: ActionEmailTemplate) => void;
  onChangeFr: (next: ActionEmailTemplate) => void;
  contentRevision: number;
  disabled?: boolean;
  showResetToDefault?: boolean;
  resetLoading?: boolean;
  onResetToDefault?: () => void;
};

async function compileTemplate(
  ref: EmailEditorRef | null,
  subject: string,
  theme_id: string | null,
): Promise<ActionEmailTemplate> {
  if (!ref) return { subject, html: '', ...(theme_id ? { theme_id } : {}) };
  const document = ref.getJSON() as ActionEmailDocument;
  const html = await ref.getEmailHTML();
  return { subject, document, html, ...(theme_id ? { theme_id } : {}) };
}

function ColumnToggleGroup<T extends string>({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div
      className="flex flex-wrap gap-1"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          size="sm"
          variant={value === opt.value ? 'secondary' : 'outline'}
          className="h-7 font-mono text-[10px] uppercase tracking-wide"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

function LangEditorSurface({
  lang,
  template,
  onTemplateChange,
  themeInput,
  themeName,
  themeRenderKey,
  editorKey,
  disabled,
  editorRef,
  bodyMode,
  onBodyModeChange,
  previewMode,
  onPreviewModeChange,
  jsonDraft,
  onJsonDraftChange,
  jsonError,
  onJsonError,
}: {
  lang: LangTab;
  template: ActionEmailTemplate;
  onTemplateChange: (next: ActionEmailTemplate) => void;
  themeInput: ReturnType<typeof actionEmailThemeInput>;
  themeName: string | null;
  themeRenderKey: string;
  editorKey: string;
  disabled?: boolean;
  editorRef: React.MutableRefObject<EmailEditorRef | null>;
  bodyMode: BodySourceMode;
  onBodyModeChange: (mode: BodySourceMode) => void;
  previewMode: PreviewDisplayMode;
  onPreviewModeChange: (mode: PreviewDisplayMode) => void;
  jsonDraft: string;
  onJsonDraftChange: (value: string) => void;
  jsonError: string | null;
  onJsonError: (message: string | null) => void;
}) {
  const { t } = useTranslation();
  const [previewHtml, setPreviewHtml] = useState('');
  const mountKey = `${editorKey}|${themeRenderKey}`;
  const syncGenerationRef = useRef(mountKey);

  useEffect(() => {
    syncGenerationRef.current = mountKey;
  }, [mountKey]);

  const content = useMemo(() => resolveEmailEditorContent(template, lang), [lang, template]);

  const refreshPreview = useCallback(async (ref: EmailEditorRef | null) => {
    if (!ref) {
      setPreviewHtml('');
      return;
    }
    try {
      setPreviewHtml(await ref.getEmailHTML());
    } catch {
      setPreviewHtml('');
    }
  }, []);

  const syncTemplate = useCallback(
    async (ref: EmailEditorRef, generation: string) => {
      if (generation !== syncGenerationRef.current) return;
      const next = await compileTemplate(ref, template.subject, themeName);
      if (generation !== syncGenerationRef.current) return;
      onTemplateChange({ ...next, ...(themeName ? { theme_id: themeName } : {}) });
      await refreshPreview(ref);
    },
    [onTemplateChange, refreshPreview, template.subject, themeName],
  );

  const reactDebugSource = useMemo(() => {
    const json =
      (editorRef.current?.getJSON() as ActionEmailDocument | undefined) ?? template.document;
    return formatDocumentAsReactDebugSource(json);
  }, [editorRef, previewHtml, template.document]);

  const syncJsonDraftFromEditor = useCallback(() => {
    const json = editorRef.current?.getJSON();
    onJsonDraftChange(JSON.stringify(json ?? { type: 'doc', content: [] }, null, 2));
    onJsonError(null);
  }, [editorRef, onJsonDraftChange, onJsonError]);

  const selectBodyMode = useCallback(
    (mode: BodySourceMode) => {
      if (mode === 'json') syncJsonDraftFromEditor();
      onBodyModeChange(mode);
    },
    [onBodyModeChange, syncJsonDraftFromEditor],
  );

  const applyJsonDocument = useCallback(() => {
    onJsonError(null);
    try {
      const document = parseEmailDocumentJson(jsonDraft);
      const editor = editorRef.current?.editor;
      if (!editor) {
        onJsonError(t('actionsEmailRawEditorNotReady'));
        return;
      }
      editor.commands.setContent(document, { emitUpdate: true });
      void (async () => {
        const ref = editorRef.current;
        if (!ref) return;
        await syncTemplate(ref, syncGenerationRef.current);
      })();
    } catch (e) {
      onJsonError(e instanceof Error ? e.message : t('actionsEmailRawInvalid'));
    }
  }, [editorRef, jsonDraft, onJsonError, syncTemplate, t]);

  const copyReactSource = useCallback(() => {
    void navigator.clipboard.writeText(reactDebugSource);
  }, [reactDebugSource]);

  const panelClass = 'min-h-[26rem] flex-1 overflow-auto rounded-md border border-border/80';

  return (
    <div className="grid min-h-[28rem] gap-4 lg:grid-cols-2 lg:items-start">
      <div className="flex min-h-[28rem] flex-col gap-2">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('actionsEmailDocumentLabel')}
          </p>
          <ColumnToggleGroup
            ariaLabel={t('actionsEmailDocumentLabel')}
            value={bodyMode}
            disabled={disabled}
            options={[
              { value: 'visual', label: t('actionsEmailModeVisual') },
              { value: 'json', label: t('actionsEmailModeJson') },
              { value: 'react', label: t('actionsEmailModeReact') },
            ]}
            onChange={selectBodyMode}
          />
        </div>

        <div
          className={cn(
            panelClass,
            'overflow-hidden bg-background',
            bodyMode !== 'visual' && 'hidden',
            disabled && bodyMode === 'visual' && 'pointer-events-none opacity-60',
          )}
          aria-hidden={bodyMode !== 'visual'}
        >
          <EmailEditor
            key={mountKey}
            ref={editorRef}
            content={content}
            theme={themeInput}
            editable={!disabled && bodyMode === 'visual'}
            className="min-h-[26rem]"
            onReady={(ref) => {
              if (mountKey !== syncGenerationRef.current) return;
              editorRef.current = ref;
              void syncTemplate(ref, mountKey);
            }}
            onUpdate={(ref) => {
              if (mountKey !== syncGenerationRef.current) return;
              editorRef.current = ref;
              void syncTemplate(ref, mountKey);
            }}
          />
        </div>

        {bodyMode === 'json' ? (
          <div className={cn('flex flex-col gap-2', panelClass, 'bg-muted/10 p-0')}>
            <textarea
              value={jsonDraft}
              disabled={disabled}
              spellCheck={false}
              className="min-h-[22rem] flex-1 resize-none border-0 bg-transparent p-3 font-mono text-xs leading-relaxed focus-visible:outline-none"
              aria-label={t('actionsEmailRawLabel')}
              onChange={(e) => {
                onJsonDraftChange(e.target.value);
                onJsonError(null);
              }}
            />
            {jsonError ? (
              <Text className="px-3 font-mono text-xs text-destructive">{jsonError}</Text>
            ) : null}
            <div className="flex flex-wrap gap-2 px-3 pb-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled}
                onClick={applyJsonDocument}
              >
                {t('actionsEmailRawApply')}
              </Button>
            </div>
            <Text className="px-3 pb-3 font-mono text-[10px] text-muted-foreground">
              {t('actionsEmailRawHelp')}
            </Text>
          </div>
        ) : null}

        {bodyMode === 'react' ? (
          <div className={cn('flex flex-col gap-2', panelClass, 'bg-muted/10 p-0')}>
            <textarea
              readOnly
              value={reactDebugSource}
              spellCheck={false}
              className="min-h-[22rem] flex-1 resize-none border-0 bg-transparent p-3 font-mono text-xs leading-relaxed focus-visible:outline-none"
              aria-label={t('actionsEmailModeReact')}
            />
            <div className="flex flex-wrap gap-2 px-3 pb-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={copyReactSource}
              >
                {t('actionsEmailCopySource')}
              </Button>
            </div>
            <Text className="px-3 pb-3 font-mono text-[10px] text-muted-foreground">
              {t('actionsEmailReactViewHelp')}
            </Text>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-[28rem] flex-col gap-2">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('actionsEmailPreview')}
          </p>
          <ColumnToggleGroup
            ariaLabel={t('actionsEmailPreview')}
            value={previewMode}
            disabled={disabled}
            options={[
              { value: 'preview', label: t('actionsEmailPreviewTogglePreview') },
              { value: 'raw', label: t('actionsEmailPreviewToggleRaw') },
            ]}
            onChange={onPreviewModeChange}
          />
        </div>

        {previewMode === 'preview' ? (
          <div className={cn(panelClass, 'overflow-hidden bg-muted/20 p-0')}>
            <iframe
              title={t('actionsEmailPreview')}
              className="h-full min-h-[26rem] w-full bg-white"
              sandbox=""
              srcDoc={previewHtml || '<p></p>'}
            />
          </div>
        ) : (
          <textarea
            readOnly
            value={previewHtml || ''}
            spellCheck={false}
            className={cn(panelClass, 'bg-muted/10 p-3 font-mono text-xs leading-relaxed')}
            aria-label={t('actionsEmailPreviewToggleRaw')}
          />
        )}
        <Text className="font-mono text-[10px] text-muted-foreground">
          {t('actionsEmailPreviewHint')}
        </Text>
      </div>
    </div>
  );
}

export const ReactEmailActionEditor = forwardRef<ReactEmailActionEditorHandle, Props>(
  function ReactEmailActionEditor(
    {
      templateVariables,
      valueEn,
      valueFr,
      onChangeEn,
      onChangeFr,
      contentRevision,
      disabled,
      showResetToDefault,
      resetLoading,
      onResetToDefault,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const appearance = useTheme();
    const [tab, setTab] = useState<LangTab>('en');
    const [bodyMode, setBodyMode] = useState<BodySourceMode>('visual');
    const [previewMode, setPreviewMode] = useState<PreviewDisplayMode>('preview');
    const availableThemes = useMemo(
      () => getAppearanceAvailableThemes(appearance),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- stable when theme names unchanged
      [availableThemeNamesKey(getAppearanceAvailableThemes(appearance))],
    );
    const catalogKey = useMemo(() => availableThemeNamesKey(availableThemes), [availableThemes]);
    const appearanceMode = appearance?.mode ?? 'light';
    const appearanceActiveName = appearance?.name ?? '';

    const [selectedThemeName, setSelectedThemeName] = useState<string | null>(() =>
      resolveEmailThemeName(undefined, appearance, availableThemes),
    );
    const hydratedRevisionRef = useRef<number | null>(null);
    const prevTabRef = useRef(tab);
    const [jsonDraftEn, setJsonDraftEn] = useState('');
    const [jsonDraftFr, setJsonDraftFr] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const enRef = useRef<EmailEditorRef | null>(null);
    const frRef = useRef<EmailEditorRef | null>(null);

    const activeTemplate = tab === 'en' ? valueEn : valueFr;
    const setActiveTemplate = tab === 'en' ? onChangeEn : onChangeFr;

    useEffect(() => {
      if (hydratedRevisionRef.current === contentRevision) return;
      hydratedRevisionRef.current = contentRevision;
      const stored = valueEn.theme_id ?? valueFr.theme_id;
      setSelectedThemeName((prev) => {
        const resolved = resolveEmailThemeName(
          stored ?? prev ?? undefined,
          appearance,
          availableThemes,
        );
        return resolved ?? prev;
      });
      // Hydrate from stored theme_id only when contentRevision changes (load, reset, post-save).
    }, [
      contentRevision,
      valueEn.theme_id,
      valueFr.theme_id,
      catalogKey,
      appearanceMode,
      appearanceActiveName,
      appearance,
      availableThemes,
    ]);

    useEffect(() => {
      if (prevTabRef.current === tab) return;
      prevTabRef.current = tab;
      const stored = tab === 'en' ? valueEn.theme_id : valueFr.theme_id;
      if (!stored) return;
      setSelectedThemeName((prev) => (prev === stored ? prev : stored));
    }, [tab, valueEn.theme_id, valueFr.theme_id]);

    useEffect(() => {
      if (!catalogKey) return;
      setSelectedThemeName((prev) => {
        if (prev && availableThemes.some((theme) => theme.name === prev)) return prev;
        const stored = valueEn.theme_id ?? valueFr.theme_id ?? prev ?? undefined;
        const resolved = resolveEmailThemeName(stored, appearance, availableThemes);
        return resolved ?? prev;
      });
    }, [
      appearance,
      appearanceActiveName,
      appearanceMode,
      availableThemes,
      catalogKey,
      valueEn.theme_id,
      valueFr.theme_id,
    ]);

    const themeInput = useMemo(
      () => actionEmailThemeInput(selectedThemeName, appearance, availableThemes),
      [appearance, appearanceMode, availableThemes, selectedThemeName],
    );

    const themeRenderKey = useMemo(
      () => `${selectedThemeName ?? 'none'}|${appearanceMode}`,
      [appearanceMode, selectedThemeName],
    );

    const patchThemeOnTemplates = useCallback(
      (nextThemeName: string) => {
        setSelectedThemeName(nextThemeName);
        onChangeEn({ ...valueEn, theme_id: nextThemeName });
        onChangeFr({ ...valueFr, theme_id: nextThemeName });
      },
      [onChangeEn, onChangeFr, valueEn, valueFr],
    );

    useImperativeHandle(
      ref,
      () => ({
        compileAll: async () => {
          const en = await compileTemplate(enRef.current, valueEn.subject, selectedThemeName);
          const fr = await compileTemplate(frRef.current, valueFr.subject, selectedThemeName);
          const theme_id = selectedThemeName ?? undefined;
          const compiled = {
            en: { ...en, ...(theme_id ? { theme_id } : {}) },
            fr: { ...fr, ...(theme_id ? { theme_id } : {}) },
          };
          onChangeEn(compiled.en);
          onChangeFr(compiled.fr);
          return compiled;
        },
      }),
      [onChangeEn, onChangeFr, selectedThemeName, valueEn.subject, valueFr.subject],
    );

    const editorKeyEn = `en-${contentRevision}`;
    const editorKeyFr = `fr-${contentRevision}`;

    const insertVariable = useCallback(
      (token: string) => {
        if (bodyMode === 'json') {
          const draft = tab === 'en' ? jsonDraftEn : jsonDraftFr;
          const insert = `{{ ${token} }}`;
          const next = draft + (draft.endsWith('\n') || draft.length === 0 ? '' : ' ') + insert;
          if (tab === 'en') setJsonDraftEn(next);
          else setJsonDraftFr(next);
          return;
        }
        if (bodyMode === 'react') return;
        const editorRef = tab === 'en' ? enRef : frRef;
        editorRef.current?.editor?.chain().focus().insertContent(`{{ ${token} }}`).run();
      },
      [bodyMode, jsonDraftEn, jsonDraftFr, tab],
    );

    return (
      <div className="space-y-4">
        <div className="rounded-md border border-amber-200/80 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="font-mono text-xs text-amber-950 dark:text-amber-100">
            {t('actionsEmailRebakeNotice')}
          </p>
          <p className="mt-1 font-mono text-[10px] text-amber-900/80 dark:text-amber-200/80">
            {t('actionsEmailSaveThemeHint')}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <LangTabs
            tab={tab}
            onTab={setTab}
          />
          {showResetToDefault && onResetToDefault ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || resetLoading}
              onClick={onResetToDefault}
            >
              {resetLoading ? (
                <>
                  <Loader2
                    className="mr-2 size-3.5 animate-spin"
                    aria-hidden
                  />
                  {t('actionsEmailResetLoading')}
                </>
              ) : (
                t('actionsEmailResetToDefault')
              )}
            </Button>
          ) : null}
        </div>

        <label className="block space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('actionsEmailSubjectLabel', { lang: tab })}
          </span>
          <Input
            value={activeTemplate.subject}
            disabled={disabled}
            className="font-mono text-sm"
            onChange={(e) => setActiveTemplate({ ...activeTemplate, subject: e.target.value })}
          />
        </label>

        {templateVariables?.length ? (
          <div className="space-y-2 rounded-md border border-border/80 bg-muted/20 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('actionsEmailPlaceholders')}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {t('actionsEmailPlaceholdersHelp')}
            </p>
            <div className="flex flex-wrap gap-2">
              {templateVariables.map((v) => (
                <Button
                  key={v.token}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 font-mono text-[10px]"
                  disabled={disabled}
                  title={v.description ?? v.token}
                  onClick={() => insertVariable(v.token)}
                >
                  {`{{ ${v.token} }}`}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <label className="block max-w-md space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('actionsEmailThemeLabel')}
          </span>
          {availableThemes.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/80 px-3 py-2 font-mono text-xs text-muted-foreground">
              {t('actionsEmailThemeEmpty')}
            </p>
          ) : (
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 font-mono text-sm"
              value={selectedThemeName ?? ''}
              disabled={disabled || !selectedThemeName}
              onChange={(e) => patchThemeOnTemplates(e.target.value)}
            >
              {availableThemes.map((theme) => (
                <option
                  key={theme.name}
                  value={theme.name}
                >
                  {theme.displayName}
                </option>
              ))}
            </select>
          )}
          <p className="font-mono text-[10px] text-muted-foreground">
            {t('actionsEmailThemeHelp', { mode: appearance?.mode ?? 'light' })}
          </p>
        </label>

        <div className={tab === 'en' ? undefined : 'hidden'}>
          <LangEditorSurface
            lang="en"
            template={valueEn}
            onTemplateChange={onChangeEn}
            themeInput={themeInput}
            themeName={selectedThemeName}
            themeRenderKey={themeRenderKey}
            editorKey={editorKeyEn}
            disabled={disabled}
            editorRef={enRef}
            bodyMode={bodyMode}
            onBodyModeChange={setBodyMode}
            previewMode={previewMode}
            onPreviewModeChange={setPreviewMode}
            jsonDraft={jsonDraftEn}
            onJsonDraftChange={setJsonDraftEn}
            jsonError={jsonError}
            onJsonError={setJsonError}
          />
        </div>
        <div className={tab === 'fr' ? undefined : 'hidden'}>
          <LangEditorSurface
            lang="fr"
            template={valueFr}
            onTemplateChange={onChangeFr}
            themeInput={themeInput}
            themeName={selectedThemeName}
            themeRenderKey={themeRenderKey}
            editorKey={editorKeyFr}
            disabled={disabled}
            editorRef={frRef}
            bodyMode={bodyMode}
            onBodyModeChange={setBodyMode}
            previewMode={previewMode}
            onPreviewModeChange={setPreviewMode}
            jsonDraft={jsonDraftFr}
            onJsonDraftChange={setJsonDraftFr}
            jsonError={jsonError}
            onJsonError={setJsonError}
          />
        </div>

        <Text className="font-mono text-[10px] text-muted-foreground">
          {t('actionsEmailEditorNote')}
        </Text>
      </div>
    );
  },
);

function LangTabs({ tab, onTab }: { tab: LangTab; onTab: (tab: LangTab) => void }) {
  return (
    <div className="flex gap-2">
      {(['en', 'fr'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          className={cn(
            'rounded-md px-3 py-1 font-mono text-xs uppercase',
            tab === lang ? 'bg-muted font-semibold' : 'text-muted-foreground hover:bg-muted/50',
          )}
          onClick={() => onTab(lang)}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
