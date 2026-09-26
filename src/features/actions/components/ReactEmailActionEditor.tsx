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
import {
  actionEmailThemeInput,
  getAppearanceAvailableThemes,
  resolveEmailThemeName,
} from '@/lib/actionEmailTheme';
import type { ActionEmailDocument } from '@/features/actions/emailDocument';
import type { ActionEmailTemplate, ActionTemplateVariable } from '@/features/actions/types';
import { cn } from '@/lib/utils';

type LangTab = ActionEmailLang;
type EditorSurfaceMode = 'visual' | 'raw';

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
  surfaceMode,
  rawDraft,
  onRawDraftChange,
  rawError,
  onRawError,
}: {
  lang: LangTab;
  template: ActionEmailTemplate;
  onTemplateChange: (next: ActionEmailTemplate) => void;
  themeInput: ReturnType<typeof actionEmailThemeInput>;
  themeName: string | null;
  /** Bumps when selected catalog theme or Shellui light/dark mode changes (live preview). */
  themeRenderKey: string;
  editorKey: string;
  disabled?: boolean;
  editorRef: React.MutableRefObject<EmailEditorRef | null>;
  surfaceMode: EditorSurfaceMode;
  rawDraft: string;
  onRawDraftChange: (value: string) => void;
  rawError: string | null;
  onRawError: (message: string | null) => void;
}) {
  const { t } = useTranslation();
  const [previewHtml, setPreviewHtml] = useState('');
  const mountKey = `${editorKey}|${themeRenderKey}`;
  const syncGenerationRef = useRef(mountKey);

  useEffect(() => {
    syncGenerationRef.current = mountKey;
    editorRef.current = null;
  }, [editorRef, mountKey]);

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      if (cancelled) return;
      const ref = editorRef.current;
      if (!ref) return;
      await refreshPreview(ref);
    })();
    return () => {
      cancelled = true;
    };
  }, [editorRef, mountKey, refreshPreview, surfaceMode, themeInput, themeRenderKey]);

  const applyRawDocument = useCallback(() => {
    onRawError(null);
    try {
      const document = parseEmailDocumentJson(rawDraft);
      const editor = editorRef.current?.editor;
      if (!editor) {
        onRawError(t('actionsEmailRawEditorNotReady'));
        return;
      }
      editor.commands.setContent(document, { emitUpdate: true });
      void (async () => {
        const ref = editorRef.current;
        if (!ref) return;
        await syncTemplate(ref, syncGenerationRef.current);
      })();
    } catch (e) {
      onRawError(e instanceof Error ? e.message : t('actionsEmailRawInvalid'));
    }
  }, [editorRef, onRawError, rawDraft, syncTemplate, t]);

  return (
    <div className="grid min-h-[28rem] gap-4 lg:grid-cols-2 lg:items-start">
      <div className="flex min-h-[28rem] flex-col space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {surfaceMode === 'visual' ? t('actionsEmailDocumentLabel') : t('actionsEmailRawLabel')}
        </p>
        <div
          className={cn(
            'min-h-[26rem] flex-1 overflow-hidden rounded-md border border-border/80 bg-background',
            surfaceMode !== 'visual' && 'sr-only',
            disabled && 'pointer-events-none opacity-60',
          )}
          aria-hidden={surfaceMode !== 'visual'}
        >
          <EmailEditor
            key={mountKey}
            ref={editorRef}
            content={content}
            theme={themeInput}
            editable={!disabled && surfaceMode === 'visual'}
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
        {surfaceMode === 'raw' ? (
          <div className="flex min-h-[26rem] flex-1 flex-col gap-2">
            <textarea
              value={rawDraft}
              disabled={disabled}
              spellCheck={false}
              className="min-h-[22rem] flex-1 rounded-md border border-input bg-muted/10 p-3 font-mono text-xs leading-relaxed"
              aria-label={t('actionsEmailRawLabel')}
              onChange={(e) => {
                onRawDraftChange(e.target.value);
                onRawError(null);
              }}
            />
            {rawError ? (
              <Text className="font-mono text-xs text-destructive">{rawError}</Text>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={applyRawDocument}
            >
              {t('actionsEmailRawApply')}
            </Button>
            <Text className="font-mono text-[10px] text-muted-foreground">
              {t('actionsEmailRawHelp')}
            </Text>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-[28rem] flex-col space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {t('actionsEmailPreview')}
        </p>
        <div className="min-h-[26rem] flex-1 overflow-hidden rounded-md border border-border/80 bg-muted/20">
          <iframe
            title={t('actionsEmailPreview')}
            className="h-full min-h-[26rem] w-full bg-white"
            sandbox=""
            srcDoc={previewHtml || '<p></p>'}
          />
        </div>
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
    const [surfaceMode, setSurfaceMode] = useState<EditorSurfaceMode>('visual');
    const availableThemes = useMemo(() => getAppearanceAvailableThemes(appearance), [appearance]);
    const [selectedThemeName, setSelectedThemeName] = useState<string | null>(() =>
      resolveEmailThemeName(undefined, appearance),
    );
    const [rawDraftEn, setRawDraftEn] = useState('');
    const [rawDraftFr, setRawDraftFr] = useState('');
    const [rawError, setRawError] = useState<string | null>(null);
    const enRef = useRef<EmailEditorRef | null>(null);
    const frRef = useRef<EmailEditorRef | null>(null);

    const activeTemplate = tab === 'en' ? valueEn : valueFr;
    const setActiveTemplate = tab === 'en' ? onChangeEn : onChangeFr;

    useEffect(() => {
      const stored = tab === 'en' ? valueEn.theme_id : valueFr.theme_id;
      setSelectedThemeName(resolveEmailThemeName(stored, appearance));
    }, [appearance, contentRevision, tab, valueEn.theme_id, valueFr.theme_id]);

    useEffect(() => {
      if (selectedThemeName && !availableThemes.some((t) => t.name === selectedThemeName)) {
        setSelectedThemeName(resolveEmailThemeName(undefined, appearance));
      }
    }, [appearance, availableThemes, selectedThemeName]);

    const themeInput = useMemo(
      () => actionEmailThemeInput(selectedThemeName, appearance),
      [appearance, selectedThemeName],
    );

    const themeRenderKey = useMemo(
      () => `${selectedThemeName ?? 'none'}|${appearance?.mode ?? 'light'}`,
      [appearance?.mode, selectedThemeName],
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
        if (surfaceMode === 'raw') {
          const draft = tab === 'en' ? rawDraftEn : rawDraftFr;
          const insert = `{{ ${token} }}`;
          const next = draft + (draft.endsWith('\n') || draft.length === 0 ? '' : ' ') + insert;
          if (tab === 'en') setRawDraftEn(next);
          else setRawDraftFr(next);
          return;
        }
        const editorRef = tab === 'en' ? enRef : frRef;
        editorRef.current?.editor?.chain().focus().insertContent(`{{ ${token} }}`).run();
      },
      [rawDraftEn, rawDraftFr, surfaceMode, tab],
    );

    const switchToRaw = useCallback(() => {
      const editorRef = tab === 'en' ? enRef : frRef;
      const json = editorRef.current?.getJSON();
      const text = JSON.stringify(json ?? { type: 'doc', content: [] }, null, 2);
      if (tab === 'en') setRawDraftEn(text);
      else setRawDraftFr(text);
      setRawError(null);
      setSurfaceMode('raw');
    }, [tab]);

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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={surfaceMode === 'visual' ? 'secondary' : 'outline'}
              disabled={disabled}
              onClick={() => setSurfaceMode('visual')}
            >
              {t('actionsEmailModeVisual')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={surfaceMode === 'raw' ? 'secondary' : 'outline'}
              disabled={disabled}
              onClick={() => switchToRaw()}
            >
              {t('actionsEmailModeRaw')}
            </Button>
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
            surfaceMode={surfaceMode}
            rawDraft={rawDraftEn}
            onRawDraftChange={setRawDraftEn}
            rawError={rawError}
            onRawError={setRawError}
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
            surfaceMode={surfaceMode}
            rawDraft={rawDraftFr}
            onRawDraftChange={setRawDraftFr}
            rawError={rawError}
            onRawError={setRawError}
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
