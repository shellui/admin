import { Suspense, lazy, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Braces, Check, Copy, Eye, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  formatEmailPlaceholder,
  insertAtSelection,
  type EmailBlock,
  type EmailDocument,
  type EmailLang,
  type EmailVariable,
} from '@/lib/emailDocument';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { EmailColorThemePicker } from '@/features/email/components/EmailColorThemePicker';
import { EmailPreviewPane } from '@/features/email/components/EmailPreviewPane';
import { EmailSendDraftAction } from '@/features/email/components/EmailSendDraftAction';
import { SegmentedControl } from '@/features/email/components/SegmentedControl';
import type { EmailInlineEditorHandle } from '@/features/email/editor/EmailInlineEditor';
import { TEMPLATE_CHOICES } from '@/features/email/templates/catalog';
import { useRenderedEmail } from '@/features/email/templates/useRenderedEmail';
import { emailErrorText } from '@/lib/emailApiErrors';
import { requiredAuthLinkTokens, validateAuthLaneOverride } from '@/lib/emailAuthTemplate';
import { fillSampleData, sampleValues } from '@/lib/emailSampleData';
import {
  CUSTOM_COLORS,
  TEMPLATE_COLORS,
  colorThemePalette,
  completeThemePalette,
  emailThemeKeyOrDefault,
  matchColorTheme,
  type EmailThemeKey,
} from '@/lib/emailTheme';
import {
  parseTemplateJson,
  templateJsonText,
  type EmailTemplateJsonError,
} from '@/lib/emailTemplateJson';
import { cn } from '@/lib/utils';

const EmailInlineEditor = lazy(() => import('@/features/email/editor/EmailInlineEditor'));

export type EmailLangDraft = {
  subject: string;
  preheader: string;
  document: EmailDocument;
  templateId: number | null;
};

type EditorMode = 'edit' | 'preview' | 'json';

type InboxField = 'subject' | 'preheader' | 'preview';

type FocusTarget =
  | { lang: EmailLang; field: InboxField; start: number; end: number }
  | { lang: EmailLang; field: 'body' };

export function EmailTemplateEditor({
  laneClass,
  authLinkHosts,
  storedTemplate,
  storedPalette = null,
  companyTemplate = 'barebone',
  languages = ['en', 'fr'],
  draftEn,
  draftFr,
  variables,
  hasCompanyTemplate,
  publishing,
  resetting,
  sendingDraft,
  isStaff,
  jwtEmail,
  onChange,
  onPublish,
  onReset,
  onSendDraft,
}: {
  laneClass: string;
  authLinkHosts: string[];
  /** Template key stored on the version (`theme_name` in the API). */
  storedTemplate: string | null;
  /** Stored version palette. `{}` or null keeps the template colors. */
  storedPalette?: Record<string, string> | null;
  companyTemplate?: string;
  languages?: EmailLang[];
  draftEn: EmailLangDraft;
  draftFr: EmailLangDraft;
  variables: EmailVariable[];
  hasCompanyTemplate: boolean;
  publishing: boolean;
  resetting: boolean;
  sendingDraft: boolean;
  isStaff: boolean;
  jwtEmail: string | null;
  onChange: (lang: EmailLang, next: EmailLangDraft) => void;
  onPublish: (template: string, themePalette: Record<string, string>) => Promise<void>;
  onReset: () => Promise<boolean>;
  onSendDraft: (
    lang: EmailLang,
    draft: EmailLangDraft,
    template: string,
    themePalette: Record<string, string>,
    to?: string,
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<EmailThemeKey>(() =>
    emailThemeKeyOrDefault(storedTemplate, companyTemplate),
  );
  const [colorTheme, setColorTheme] = useState(() => matchColorTheme(storedPalette));
  const [customPalette, setCustomPalette] = useState(() =>
    matchColorTheme(storedPalette) === CUSTOM_COLORS ? completeThemePalette(storedPalette) : null,
  );
  const [mode, setMode] = useState<EditorMode>('edit');
  const [lang, setLang] = useState<EmailLang>(languages[0] ?? 'en');
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<EmailTemplateJsonError | null>(null);
  const [jsonCopied, setJsonCopied] = useState(false);
  const jsonRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<EmailInlineEditorHandle>(null);
  const [draftTo, setDraftTo] = useState(jwtEmail ?? '');
  const [draftFeedback, setDraftFeedback] = useState<ActionFeedbackState | null>(null);
  const [publishFeedback, setPublishFeedback] = useState<ActionFeedbackState | null>(null);
  const [resetFeedback, setResetFeedback] = useState<ActionFeedbackState | null>(null);
  const draft = lang === 'fr' ? draftFr : draftEn;
  const palette = useMemo<Record<string, string>>(() => {
    if (colorTheme === TEMPLATE_COLORS) return {};
    if (colorTheme === CUSTOM_COLORS) return customPalette ?? {};
    return colorThemePalette(colorTheme) ?? {};
  }, [colorTheme, customPalette]);
  const rendered = useRenderedEmail({ template, palette, document: draft.document });
  const samples = useMemo(() => sampleValues(variables), [variables]);
  const previewHtml = rendered.html ? fillSampleData(rendered.html, samples, { html: true }) : null;

  // Documents written here keep the editor mounted. Any other document (language
  // switch, JSON paste, reset, first load) remounts it with that content.
  const ownDocuments = useRef(new WeakSet<EmailDocument>());
  const editorRevision = useRef(0);
  if (!ownDocuments.current.has(draft.document)) {
    ownDocuments.current.add(draft.document);
    editorRevision.current += 1;
  }
  const editorKey = `${lang}:${editorRevision.current}`;

  const authTokens = useMemo(() => requiredAuthLinkTokens(variables), [variables]);
  const authIssue =
    laneClass === 'auth'
      ? validateAuthLaneOverride({
          laneClass,
          variables,
          authLinkHosts,
          subject: draft.subject,
          preheader: draft.preheader,
          document: draft.document,
        })
      : null;
  function literalBeside(field: string): string | null {
    if (authIssue?.errorCode !== 'auth_literal_link') return null;
    return authIssue.fieldErrors[field]?.includes('literal_url')
      ? t('emailError_auth_literal_link')
      : null;
  }

  function clearActionFeedback() {
    setDraftFeedback(null);
    setPublishFeedback(null);
    setResetFeedback(null);
  }

  function patch(next: Partial<EmailLangDraft>) {
    clearActionFeedback();
    onChange(lang, { ...draft, ...next });
  }

  function patchDocument(document: EmailDocument) {
    ownDocuments.current.add(document);
    patch({ document });
  }

  function editBlocks(blocks: EmailBlock[]) {
    patchDocument({ ...draft.document, blocks });
  }

  function jsonFor(source: EmailLangDraft): string {
    return templateJsonText({
      subject: source.subject,
      preheader: source.preheader,
      document: source.document,
      theme_name: template,
      theme_palette: palette,
    });
  }

  function resetJson(source: EmailLangDraft) {
    setJsonText(jsonFor(source));
    setJsonError(null);
    setJsonCopied(false);
  }

  function switchMode(next: EditorMode) {
    if (next === 'json') resetJson(draft);
    setMode(next);
  }

  function switchLang(next: EmailLang) {
    setLang(next);
    setFocus(null);
    clearActionFeedback();
    if (mode === 'json') resetJson(next === 'fr' ? draftFr : draftEn);
  }

  function pickTemplate(next: string) {
    clearActionFeedback();
    setTemplate(emailThemeKeyOrDefault(next, companyTemplate));
  }

  function pickColorTheme(next: string) {
    clearActionFeedback();
    setColorTheme(next);
  }

  function applyPalette(next: Record<string, string>) {
    const key = matchColorTheme(next);
    if (key === CUSTOM_COLORS) setCustomPalette(completeThemePalette(next));
    setColorTheme(key);
  }

  function editJson(text: string) {
    setJsonText(text);
    setJsonCopied(false);
    const parsed = parseTemplateJson(text);
    if (!parsed.ok) {
      setJsonError(parsed.error);
      return;
    }
    setJsonError(null);
    const value = parsed.value;
    patch({
      subject: value.subject ?? draft.subject,
      preheader: value.preheader ?? draft.preheader,
      document: value.document,
    });
    if (value.theme_name) setTemplate(emailThemeKeyOrDefault(value.theme_name, companyTemplate));
    if (value.theme_palette) applyPalette(value.theme_palette);
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(jsonText);
    } catch {
      jsonRef.current?.select();
      document.execCommand('copy');
    }
    setJsonCopied(true);
  }

  function jsonErrorText(error: EmailTemplateJsonError): string {
    if (error.code === 'invalid_block') {
      return t('emailJsonError_invalid_block', { index: error.index + 1 });
    }
    if (error.code === 'invalid_field')
      return t('emailJsonError_invalid_field', { field: error.field });
    if (error.code === 'unknown_template') {
      return t('emailJsonError_unknown_template', { value: error.value });
    }
    return t(`emailJsonError_${error.code}`);
  }

  async function publishTemplate() {
    setPublishFeedback(null);
    try {
      await onPublish(template, palette);
      setPublishFeedback({ tone: 'success', text: t('emailPublished') });
    } catch (err) {
      setPublishFeedback(feedbackFromError(t, err));
    }
  }

  async function resetTemplate() {
    setResetFeedback(null);
    try {
      const completed = await onReset();
      if (completed) setResetFeedback({ tone: 'success', text: t('emailResetDone') });
    } catch (err) {
      setResetFeedback(feedbackFromError(t, err));
    }
  }

  async function sendThisDraft() {
    setDraftFeedback(null);
    try {
      await onSendDraft(lang, draft, template, palette, isStaff ? draftTo.trim() : undefined);
      setDraftFeedback({ tone: 'success', text: t('emailSendDraftSent') });
    } catch (err) {
      setDraftFeedback(feedbackFromError(t, err));
    }
  }

  function rememberFocus(field: InboxField, element: HTMLInputElement) {
    setFocus({ lang, field, start: element.selectionStart ?? 0, end: element.selectionEnd ?? 0 });
  }

  function insertVariable(token: string) {
    const placeholder = formatEmailPlaceholder(token);
    if (!focus || focus.lang !== lang || focus.field === 'body') {
      editorRef.current?.insertText(placeholder);
      return;
    }
    const current = focus.field === 'preview' ? draft.document.preview : draft[focus.field];
    const next = insertAtSelection(current, focus.start, focus.end, placeholder);
    if (focus.field === 'preview') patchDocument({ ...draft.document, preview: next.value });
    else patch({ [focus.field]: next.value });
    setFocus({ ...focus, start: next.caret, end: next.caret });
  }

  const editPane = (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold tracking-tight">{t('emailInboxSection')}</h2>
        <div className="space-y-2">
          <Label htmlFor="email-subject">{t('emailSubjectLabel')}</Label>
          <Input
            id="email-subject"
            value={draft.subject}
            onChange={(event) => patch({ subject: event.target.value })}
            onSelect={(event) => rememberFocus('subject', event.currentTarget)}
            onBlur={(event) => rememberFocus('subject', event.currentTarget)}
          />
          {literalBeside('subject') ? (
            <Text className="font-mono text-xs text-destructive">{literalBeside('subject')}</Text>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email-preheader">{t('emailPreheaderLabel')}</Label>
            <Input
              id="email-preheader"
              value={draft.preheader}
              onChange={(event) => patch({ preheader: event.target.value })}
              onSelect={(event) => rememberFocus('preheader', event.currentTarget)}
              onBlur={(event) => rememberFocus('preheader', event.currentTarget)}
            />
            {literalBeside('preheader') ? (
              <Text className="font-mono text-xs text-destructive">
                {literalBeside('preheader')}
              </Text>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-preview-text">{t('emailPreviewLabel')}</Label>
            <Input
              id="email-preview-text"
              value={draft.document.preview}
              onChange={(event) =>
                patchDocument({ ...draft.document, preview: event.target.value })
              }
              onSelect={(event) => rememberFocus('preview', event.currentTarget)}
              onBlur={(event) => rememberFocus('preview', event.currentTarget)}
            />
            {literalBeside('preview') ? (
              <Text className="font-mono text-xs text-destructive">{literalBeside('preview')}</Text>
            ) : null}
          </div>
        </div>
      </section>

      {variables.length ? (
        <section className="space-y-2.5 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-sm font-semibold tracking-tight">
              {t('emailVariablesLabel')}{' '}
              <span className="font-normal text-muted-foreground">{variables.length}</span>
            </h2>
            <Text className="text-xs">{t('emailVariablesHint')}</Text>
          </div>
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label={t('emailVariablesLabel')}
          >
            {variables.map((variable) => (
              <button
                key={variable.token}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs transition-colors hover:border-foreground/30 hover:bg-muted"
                aria-label={variable.token}
                title={
                  variable.example
                    ? t('emailVariableExample', { example: variable.example })
                    : undefined
                }
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertVariable(variable.token)}
              >
                <Plus
                  aria-hidden
                  className="size-3 text-muted-foreground"
                />
                <span className="font-mono">{formatEmailPlaceholder(variable.token)}</span>
                {variable.required ? (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t('emailVariableRequired')}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold tracking-tight">{t('emailContentSection')}</h2>
          <Text className="text-xs">{t('emailEditorHint')}</Text>
        </div>
        {literalBeside('document') ? (
          <Text className="font-mono text-xs text-destructive">{literalBeside('document')}</Text>
        ) : null}
        <Suspense
          fallback={
            <Skeleton
              className="h-80 w-full rounded-xl"
              aria-label={t('emailEditorLoading')}
            />
          }
        >
          <EmailInlineEditor
            key={editorKey}
            ref={editorRef}
            document={draft.document}
            template={template}
            palette={palette}
            variables={variables}
            label={t('emailContentSection')}
            onChange={editBlocks}
            onFocus={() => setFocus({ lang, field: 'body' })}
          />
        </Suspense>
      </section>
    </div>
  );

  const jsonPane = (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="email-template-json">{t('emailJsonLabel')}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void copyJson()}
        >
          {jsonCopied ? <Check /> : <Copy />}
          {jsonCopied ? t('emailJsonCopied') : t('emailJsonCopy')}
        </Button>
      </div>
      <Text className="text-xs">{t('emailJsonHint')}</Text>
      <textarea
        id="email-template-json"
        ref={jsonRef}
        spellCheck={false}
        aria-invalid={jsonError ? true : undefined}
        className={cn(
          'h-[36rem] w-full resize-y rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          jsonError ? 'border-destructive' : 'border-input',
        )}
        value={jsonText}
        onChange={(event) => editJson(event.target.value)}
      />
      {jsonError ? (
        <Text className="font-mono text-xs text-destructive">{jsonErrorText(jsonError)}</Text>
      ) : null}
    </div>
  );

  const previewPane = (
    <EmailPreviewPane
      html={previewHtml}
      failed={rendered.failed}
      subject={fillSampleData(draft.subject, samples, { html: false })}
      preheader={fillSampleData(draft.preheader, samples, { html: false })}
      large={mode === 'preview'}
    />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label={t('emailEditorModes')}
            value={mode}
            onChange={switchMode}
            options={[
              { value: 'edit', label: t('emailModeEdit'), icon: <Pencil /> },
              { value: 'preview', label: t('emailModePreview'), icon: <Eye /> },
              { value: 'json', label: t('emailModeJson'), icon: <Braces /> },
            ]}
          />
          {languages.length > 1 ? (
            <SegmentedControl
              label={t('emailLanguageTabs')}
              value={lang}
              onChange={switchLang}
              options={languages.map((code) => ({
                value: code,
                label: code === 'en' ? t('emailLangEn') : t('emailLangFr'),
              }))}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 px-1 text-sm">
            <span className="text-muted-foreground">{t('emailTemplateLabel')}</span>
            <select
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              aria-label={t('emailTemplateLabel')}
              value={template}
              onChange={(event) => pickTemplate(event.target.value)}
            >
              {TEMPLATE_CHOICES.map((choice) => (
                <option
                  key={choice.key}
                  value={choice.key}
                >
                  {choice.name}
                </option>
              ))}
            </select>
          </label>
          <EmailColorThemePicker
            template={template}
            value={colorTheme}
            customPalette={customPalette}
            note={t('emailEditorThemeNote')}
            onChange={pickColorTheme}
          />
        </div>
      </div>

      {laneClass === 'auth' ? (
        <Text>
          {t('emailAuthLaneNotice', {
            tokens: authTokens.map((token) => `{{ ${token} }}`).join(', '),
          })}
        </Text>
      ) : null}
      {laneClass === 'auth' && authLinkHosts.length ? (
        <Text className="font-mono text-xs">
          {t('emailAuthLinkHosts', { hosts: authLinkHosts.join(', ') })}
        </Text>
      ) : null}
      {authIssue && authIssue.errorCode !== 'auth_literal_link' ? (
        <Text className="font-mono text-sm text-destructive">{emailErrorText(t, authIssue)}</Text>
      ) : null}

      {mode === 'preview' ? previewPane : null}
      {mode === 'edit' ? editPane : null}
      {mode === 'json' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {jsonPane}
          <div className="hidden min-w-0 xl:block">
            <div className="sticky top-4">{previewPane}</div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 border-t border-border/80 pt-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="space-y-2">
            <Button
              type="button"
              disabled={publishing}
              onClick={() => void publishTemplate()}
            >
              {publishing ? t('emailPublishing') : t('emailPublish')}
            </Button>
            <ActionFeedback feedback={publishFeedback} />
          </div>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              disabled={resetting || !hasCompanyTemplate}
              onClick={() => void resetTemplate()}
            >
              {t('emailReset')}
            </Button>
            <ActionFeedback feedback={resetFeedback} />
          </div>
          <div className="space-y-2">
            <EmailSendDraftAction
              isStaff={isStaff}
              jwtEmail={jwtEmail}
              to={draftTo}
              sending={sendingDraft}
              onToChange={(value) => {
                clearActionFeedback();
                setDraftTo(value);
              }}
              onSend={() => void sendThisDraft()}
            />
            <ActionFeedback feedback={draftFeedback} />
          </div>
        </div>
      </div>
    </div>
  );
}
