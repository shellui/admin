import '@react-email/editor/themes/default.css';
import '../reactEmailEditor.css';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/contexts/ThemeContext';
import {
  parseEmailDocumentJson,
  resolveEmailEditorContent,
  stripEmbeddedEmailThemeStyles,
  type ActionEmailLang,
} from '@/lib/actionEmailDefaults';
import { formatDocumentAsReactDebugSource } from '@/lib/actionEmailDocumentDebug';
import {
  actionEmailThemeInput,
  availableThemeNamesKey,
  getAppearanceAvailableThemes,
  resolveEmailThemeName,
} from '@/lib/actionEmailTheme';
import { applyThemeInputToEditor } from '@/lib/actionEmailThemeApply';
import type { ActionEmailDocument } from '@/features/actions/emailDocument';
import type {
  ActionEmailPreviewContext,
  ActionEmailTemplate,
  ActionTemplateVariable,
} from '@/features/actions/types';
import { cn } from '@/lib/utils';
import { substituteActionEmailTemplate } from '@/lib/actionEmailPreviewSubstitute';
import { formatActionEmailPlaceholder } from '@/lib/actionEmailUrl';
import { useAllowTemplateUrlsInEmailEditor } from '@/lib/useAllowTemplateUrlsInEmailEditor';

type LangTab = ActionEmailLang;
type BodySourceMode = 'visual' | 'json' | 'react';
type PreviewDisplayMode = 'preview' | 'raw';
type PreviewDataMode = 'sample' | 'placeholders';

export type ReactEmailActionEditorHandle = {
  compileAll: () => Promise<{ en: ActionEmailTemplate; fr: ActionEmailTemplate }>;
  getActiveLang: () => 'en' | 'fr';
};

type Props = {
  templateVariables?: ActionTemplateVariable[];
  /** Identity `sample_context` (or built from field examples) for live preview. */
  previewContext?: ActionEmailPreviewContext | null;
  valueEn: ActionEmailTemplate;
  valueFr: ActionEmailTemplate;
  onChangeEn: (next: ActionEmailTemplate) => void;
  onChangeFr: (next: ActionEmailTemplate) => void;
  contentRevision: number;
  disabled?: boolean;
  showResetToDefault?: boolean;
  resetLoading?: boolean;
  onResetToDefault?: () => void;
  showSendTest?: boolean;
  sendTestLoading?: boolean;
  sendTestDisabledReason?: string | null;
  onSendTestToMyself?: () => void;
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

function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (next: T) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className="w-fit"
    >
      <TabsList
        aria-label={ariaLabel}
        className="h-8"
      >
        {options.map((opt) => (
          <TabsTrigger
            key={opt.value}
            value={opt.value}
            disabled={disabled || opt.disabled}
            className="h-6 px-2.5 font-mono text-[10px] uppercase tracking-wide"
          >
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
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
  previewDataMode,
  onPreviewDataModeChange,
  previewContext,
  jsonDraft,
  onJsonDraftChange,
  jsonError,
  onJsonError,
  jsonTextareaRef,
  onEditorSelectionChange,
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
  previewDataMode: PreviewDataMode;
  onPreviewDataModeChange: (mode: PreviewDataMode) => void;
  previewContext: ActionEmailPreviewContext | null;
  jsonDraft: string;
  onJsonDraftChange: (value: string) => void;
  jsonError: string | null;
  onJsonError: (message: string | null) => void;
  jsonTextareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  onEditorSelectionChange?: (selection: { from: number; to: number }) => void;
}) {
  const { t } = useTranslation();
  const [previewHtml, setPreviewHtml] = useState('');
  const [editorEpoch, setEditorEpoch] = useState(0);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const mountKey = `${editorKey}|${themeRenderKey}`;
  // Keep generation in sync during render so onReady after remount (reset/load) is not
  // skipped while a useEffect would still hold the previous mountKey.
  const syncGenerationRef = useRef(mountKey);
  if (syncGenerationRef.current !== mountKey) {
    syncGenerationRef.current = mountKey;
  }

  const getEditor = useCallback(() => editorRef.current?.editor ?? null, [editorRef]);
  useAllowTemplateUrlsInEmailEditor(editorShellRef, getEditor);

  useEffect(() => {
    setPreviewHtml('');
  }, [mountKey]);

  // Keep last caret range so variable chips can insert after the editor blurs.
  useEffect(() => {
    if (!onEditorSelectionChange) return;
    const editor = editorRef.current?.editor;
    if (!editor) return;
    const notify = () => {
      const { from, to } = editor.state.selection;
      onEditorSelectionChange({ from, to });
    };
    notify();
    editor.on('selectionUpdate', notify);
    editor.on('blur', notify);
    return () => {
      editor.off('selectionUpdate', notify);
      editor.off('blur', notify);
    };
  }, [editorEpoch, editorRef, mountKey, onEditorSelectionChange]);

  const content = useMemo(
    () => stripEmbeddedEmailThemeStyles(resolveEmailEditorContent(template, lang)),
    // themeRenderKey: remount with stripped globalContent so a new theme can seed
    // (embedded styles from the previous theme would otherwise win).
    [lang, template, themeRenderKey],
  );

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
      const applied = editor.commands.setContent(document, { emitUpdate: true });
      if (!applied) {
        onJsonError(t('actionsEmailRawApplyFailed'));
        return;
      }
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

  const panelClass =
    'min-h-[26rem] min-w-0 flex-1 overflow-auto rounded-md border border-border/80';

  const displayHtml = useMemo(() => {
    const raw = previewHtml?.trim() || '';
    if (!raw) return '';
    if (previewDataMode === 'sample' && previewContext) {
      return substituteActionEmailTemplate(raw, previewContext, 'html');
    }
    return raw;
  }, [previewContext, previewDataMode, previewHtml]);

  const previewSubject = useMemo(() => {
    const subject = template.subject?.trim() || '';
    if (!subject) return '';
    if (previewDataMode === 'sample' && previewContext) {
      return substituteActionEmailTemplate(subject, previewContext, 'plain');
    }
    return subject;
  }, [previewContext, previewDataMode, template.subject]);

  const previewSrcDoc = useMemo(() => {
    const raw = displayHtml || '<p></p>';
    const wrapStyles =
      'html,body{max-width:100%;overflow-x:auto;word-break:break-word;overflow-wrap:anywhere;}' +
      'img,table{max-width:100%!important;}' +
      'a{overflow-wrap:anywhere;word-break:break-all;}';
    // getEmailHTML() usually returns a full document; inject styles instead of nesting html.
    if (/<html[\s>]/i.test(raw)) {
      if (/<\/head>/i.test(raw)) {
        return raw.replace(
          /<\/head>/i,
          `<style data-shellui-preview-wrap>${wrapStyles}</style></head>`,
        );
      }
      return raw.replace(
        /<html([^>]*)>/i,
        `<html$1><head><style data-shellui-preview-wrap>${wrapStyles}</style></head>`,
      );
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style data-shellui-preview-wrap>${wrapStyles}</style></head><body>${raw}</body></html>`;
  }, [displayHtml]);

  return (
    <div className="grid min-h-[28rem] min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
      <div className="flex min-h-[28rem] min-w-0 flex-col gap-2">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('actionsEmailDocumentLabel')}
          </p>
          <SegmentedTabs
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
          ref={editorShellRef}
          className={cn(
            panelClass,
            'shellui-action-email-editor overflow-x-auto overflow-y-auto bg-background',
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
            className="min-h-[26rem] w-full min-w-0 max-w-full"
            onReady={(ref) => {
              if (mountKey !== syncGenerationRef.current) return;
              editorRef.current = ref;
              applyThemeInputToEditor(ref.editor, themeInput);
              setEditorEpoch((n) => n + 1);
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
              ref={jsonTextareaRef}
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

      <div className="flex min-h-[28rem] min-w-0 flex-col gap-2">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('actionsEmailPreview')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedTabs
              ariaLabel={t('actionsEmailPreviewDataMode')}
              value={previewDataMode}
              disabled={disabled}
              options={[
                {
                  value: 'sample',
                  label: t('actionsEmailPreviewSample'),
                  disabled: !previewContext,
                },
                { value: 'placeholders', label: t('actionsEmailPreviewPlaceholders') },
              ]}
              onChange={onPreviewDataModeChange}
            />
            <SegmentedTabs
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
        </div>

        {previewSubject ? (
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('actionsEmailPreviewSubject')}
            </p>
            <p className="mt-0.5 font-mono text-xs text-foreground">{previewSubject}</p>
          </div>
        ) : null}

        {previewMode === 'preview' ? (
          <div
            className={cn(
              panelClass,
              'shellui-action-email-preview overflow-hidden bg-muted/20 p-0',
            )}
          >
            <iframe
              title={t('actionsEmailPreview')}
              className="h-full min-h-[26rem] w-full max-w-full bg-white"
              sandbox=""
              srcDoc={previewSrcDoc}
            />
          </div>
        ) : (
          <textarea
            readOnly
            value={displayHtml || ''}
            spellCheck={false}
            className={cn(panelClass, 'bg-muted/10 p-3 font-mono text-xs leading-relaxed')}
            aria-label={t('actionsEmailPreviewToggleRaw')}
          />
        )}
        <Text className="font-mono text-[10px] text-muted-foreground">
          {previewDataMode === 'sample' && previewContext
            ? t('actionsEmailPreviewHintSample')
            : t('actionsEmailPreviewHint')}
        </Text>
      </div>
    </div>
  );
}

export const ReactEmailActionEditor = forwardRef<ReactEmailActionEditorHandle, Props>(
  function ReactEmailActionEditor(
    {
      templateVariables,
      previewContext = null,
      valueEn,
      valueFr,
      onChangeEn,
      onChangeFr,
      contentRevision,
      disabled,
      showResetToDefault,
      resetLoading,
      onResetToDefault,
      showSendTest,
      sendTestLoading,
      sendTestDisabledReason,
      onSendTestToMyself,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const appearance = useTheme();
    const [tab, setTab] = useState<LangTab>('en');
    const [bodyMode, setBodyMode] = useState<BodySourceMode>('visual');
    const [previewMode, setPreviewMode] = useState<PreviewDisplayMode>('preview');
    const [previewDataMode, setPreviewDataMode] = useState<PreviewDataMode>('sample');

    useEffect(() => {
      setPreviewDataMode(previewContext ? 'sample' : 'placeholders');
    }, [previewContext]);
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
    const subjectInputRef = useRef<HTMLInputElement | null>(null);
    const jsonTextareaEnRef = useRef<HTMLTextAreaElement | null>(null);
    const jsonTextareaFrRef = useRef<HTMLTextAreaElement | null>(null);
    const editorSelectionEnRef = useRef<{ from: number; to: number } | null>(null);
    const editorSelectionFrRef = useRef<{ from: number; to: number } | null>(null);

    const activeTemplate = tab === 'en' ? valueEn : valueFr;
    const setActiveTemplate = tab === 'en' ? onChangeEn : onChangeFr;

    const insertAtTextCaret = useCallback(
      (
        el: HTMLInputElement | HTMLTextAreaElement,
        value: string,
        apply: (next: string) => void,
        token: string,
      ) => {
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? start;
        const next = value.slice(0, start) + token + value.slice(end);
        apply(next);
        const caret = start + token.length;
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(caret, caret);
        });
      },
      [],
    );

    const onEditorSelectionEn = useCallback((selection: { from: number; to: number }) => {
      editorSelectionEnRef.current = selection;
    }, []);
    const onEditorSelectionFr = useCallback((selection: { from: number; to: number }) => {
      editorSelectionFrRef.current = selection;
    }, []);

    useEffect(() => {
      if (hydratedRevisionRef.current === contentRevision) return;
      hydratedRevisionRef.current = contentRevision;
      const stored = valueEn.theme_id ?? valueFr.theme_id;
      // On load/reset, use stored theme_id when present; otherwise resolve the Shellui
      // catalog default. Do not keep the previous picker value — that blocked "Reset to
      // default" from restoring the theme after the user had changed it.
      setSelectedThemeName((prev) => {
        const resolved = resolveEmailThemeName(stored, appearance, availableThemes);
        return resolved ?? prev;
      });
      // Clear JSON drafts so raw mode reflects reloaded/reset templates.
      setJsonDraftEn('');
      setJsonDraftFr('');
      setJsonError(null);
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
        getActiveLang: () => tab,
      }),
      [onChangeEn, onChangeFr, selectedThemeName, tab, valueEn.subject, valueFr.subject],
    );

    const editorKeyEn = `en-${contentRevision}`;
    const editorKeyFr = `fr-${contentRevision}`;

    const insertVariable = useCallback(
      (variable: ActionTemplateVariable, as: 'text' | 'href' | 'button' = 'text') => {
        const insert = formatActionEmailPlaceholder(variable.token);

        if (bodyMode === 'json') {
          const draft = tab === 'en' ? jsonDraftEn : jsonDraftFr;
          const textarea = tab === 'en' ? jsonTextareaEnRef.current : jsonTextareaFrRef.current;
          if (textarea) {
            insertAtTextCaret(
              textarea,
              draft,
              (next) => {
                if (tab === 'en') setJsonDraftEn(next);
                else setJsonDraftFr(next);
              },
              insert,
            );
            return;
          }
          const next = draft + (draft.endsWith('\n') || draft.length === 0 ? '' : ' ') + insert;
          if (tab === 'en') setJsonDraftEn(next);
          else setJsonDraftFr(next);
          return;
        }

        if (bodyMode === 'react') return;

        const subjectEl = subjectInputRef.current;
        if (as === 'text' && subjectEl && document.activeElement === subjectEl) {
          insertAtTextCaret(
            subjectEl,
            activeTemplate.subject,
            (next) => setActiveTemplate({ ...activeTemplate, subject: next }),
            insert,
          );
          return;
        }

        const activeEditorRef = tab === 'en' ? enRef : frRef;
        const editor = activeEditorRef.current?.editor;
        if (!editor) return;

        const saved = tab === 'en' ? editorSelectionEnRef.current : editorSelectionFrRef.current;
        const docSize = editor.state.doc.content.size;
        const selection =
          saved && saved.from <= docSize && saved.to <= docSize
            ? saved
            : { from: editor.state.selection.from, to: editor.state.selection.to };

        const chainWithCaret = () =>
          editor.chain().focus().setTextSelection({ from: selection.from, to: selection.to });

        if (as === 'button' || (as === 'href' && editor.isActive('button'))) {
          if (editor.isActive('button')) {
            chainWithCaret().updateAttributes('button', { href: insert }).run();
            return;
          }
          chainWithCaret()
            .insertContent({
              type: 'button',
              attrs: { href: insert, class: 'button', alignment: 'center' },
              content: [
                {
                  type: 'text',
                  text: t('actionsEmailButtonDefaultLabel'),
                },
              ],
            })
            .run();
          return;
        }

        if (as === 'href') {
          if (editor.isActive('link')) {
            chainWithCaret().extendMarkRange('link').setMark('link', { href: insert }).run();
            return;
          }
          if (selection.from !== selection.to) {
            chainWithCaret().setMark('link', { href: insert }).run();
            return;
          }
          chainWithCaret()
            .insertContent({
              type: 'text',
              text: insert,
              marks: [{ type: 'link', attrs: { href: insert, target: '_blank' } }],
            })
            .run();
          return;
        }

        if (variable.isUrl && editor.isActive('button')) {
          chainWithCaret().updateAttributes('button', { href: insert }).run();
          return;
        }
        if (variable.isUrl && editor.isActive('link')) {
          chainWithCaret().extendMarkRange('link').setMark('link', { href: insert }).run();
          return;
        }

        chainWithCaret().insertContent(insert).run();
      },
      [
        activeTemplate,
        bodyMode,
        insertAtTextCaret,
        jsonDraftEn,
        jsonDraftFr,
        setActiveTemplate,
        t,
        tab,
      ],
    );

    return (
      <div className="min-w-0 space-y-4">
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
            {showSendTest && onSendTestToMyself ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled || sendTestLoading || Boolean(sendTestDisabledReason)}
                title={sendTestDisabledReason ?? undefined}
                onClick={onSendTestToMyself}
              >
                {sendTestLoading ? (
                  <>
                    <Loader2
                      className="mr-2 size-3.5 animate-spin"
                      aria-hidden
                    />
                    {t('actionsEmailSendTestLoading')}
                  </>
                ) : (
                  t('actionsEmailSendTest')
                )}
              </Button>
            ) : null}
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
            ref={subjectInputRef}
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
                <div
                  key={v.token}
                  className="flex flex-wrap items-center gap-1"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 font-mono text-[10px]"
                    disabled={disabled}
                    title={v.description ?? v.token}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertVariable(v, 'text')}
                  >
                    {formatActionEmailPlaceholder(v.token)}
                  </Button>
                  {v.isUrl ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 font-mono text-[10px]"
                        disabled={disabled || bodyMode === 'react'}
                        title={t('actionsEmailInsertVarAsLink', { var: v.token })}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertVariable(v, 'href')}
                      >
                        {t('actionsEmailInsertLinkShort')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 font-mono text-[10px]"
                        disabled={disabled || bodyMode === 'react'}
                        title={t('actionsEmailInsertVarAsButton', { var: v.token })}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertVariable(v, 'button')}
                      >
                        {t('actionsEmailInsertButtonShort')}
                      </Button>
                    </>
                  ) : null}
                </div>
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
            previewDataMode={previewDataMode}
            onPreviewDataModeChange={setPreviewDataMode}
            previewContext={previewContext}
            jsonDraft={jsonDraftEn}
            onJsonDraftChange={setJsonDraftEn}
            jsonError={jsonError}
            onJsonError={setJsonError}
            jsonTextareaRef={jsonTextareaEnRef}
            onEditorSelectionChange={onEditorSelectionEn}
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
            previewDataMode={previewDataMode}
            onPreviewDataModeChange={setPreviewDataMode}
            previewContext={previewContext}
            jsonDraft={jsonDraftFr}
            onJsonDraftChange={setJsonDraftFr}
            jsonError={jsonError}
            onJsonError={setJsonError}
            jsonTextareaRef={jsonTextareaFrRef}
            onEditorSelectionChange={onEditorSelectionFr}
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
    <SegmentedTabs
      ariaLabel="Language"
      value={tab}
      options={[
        { value: 'en', label: 'en' },
        { value: 'fr', label: 'fr' },
      ]}
      onChange={onTab}
    />
  );
}
