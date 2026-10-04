import { Suspense, lazy, useMemo, useRef, useState, type ReactNode } from 'react';
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
  type EmailDocument,
  type EmailVariable,
} from '@/lib/emailDocument';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { EmailPreviewPane } from '@/features/email/components/EmailPreviewPane';
import { EmailSendDraftAction } from '@/features/email/components/EmailSendDraftAction';
import { SegmentedControl } from '@/features/email/components/SegmentedControl';
import type { EmailInlineEditorHandle } from '@/features/email/editor/EmailInlineEditor';
import type { TranslationHighlights } from '@/features/email/editor/translationHighlight';
import type { EmailInbox } from '@/lib/emailTranslations';
import { useComposedEmail } from '@/features/email/editor/useComposedEmail';
import { emailErrorText } from '@/lib/emailApiErrors';
import { requiredAuthLinkTokens, validateAuthLaneOverride } from '@/lib/emailAuthTemplate';
import { fillSampleData, sampleValues } from '@/lib/emailSampleData';
import {
  parseTemplateJson,
  templateJsonText,
  type EmailTemplateJsonError,
} from '@/lib/emailTemplateJson';
import { cn } from '@/lib/utils';

const EmailInlineEditor = lazy(() => import('@/features/email/editor/EmailInlineEditor'));

export type EmailDraft = {
  subject: string;
  preheader: string;
  document: EmailDocument;
};

type EditorMode = 'edit' | 'preview' | 'json';

type InboxField = 'subject' | 'preheader';

type FocusTarget = { field: InboxField; start: number; end: number } | { field: 'body' };

export type EmailEditorAction = {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  /** Resolves false when the user backed out, so no success line shows. */
  run: () => Promise<boolean | void>;
  doneText: string;
};

export function EmailTemplateEditor({
  laneClass,
  authLinkHosts,
  head,
  assetsUrl,
  draft,
  documentKey = '',
  variables,
  readOnly = false,
  primary,
  secondary,
  sendDraft,
  languageBar,
  languageNotice,
  inboxFallback,
  highlights,
  onChange,
}: {
  laneClass: string;
  authLinkHosts: string[];
  /** Fonts and mobile rules of the design's set. */
  head: string;
  /** What `{{ system.assets_url }}` stands for in the canvas and preview. */
  assetsUrl: string;
  draft: EmailDraft;
  /** Which copy `draft` is, such as its language. A new key always reloads the canvas. */
  documentKey?: string;
  variables: EmailVariable[];
  /** Built-in library designs open read-only. */
  readOnly?: boolean;
  /** Publish or Save. */
  primary?: EmailEditorAction;
  /** Start over, or another outline action. */
  secondary?: EmailEditorAction;
  sendDraft?: {
    isStaff: boolean;
    jwtEmail: string | null;
    sending: boolean;
    run: (to?: string) => Promise<void>;
  };
  /** Language tabs, beside the modes. */
  languageBar?: ReactNode;
  /** Shown under the toolbar while a translation is open. */
  languageNotice?: ReactNode;
  /** What an empty subject or preheader sends, with the hint that says so. */
  inboxFallback?: EmailInbox & { hint: string };
  highlights?: TranslationHighlights | null;
  onChange: (next: EmailDraft) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<EditorMode>(readOnly ? 'preview' : 'edit');
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<EmailTemplateJsonError | null>(null);
  const [jsonCopied, setJsonCopied] = useState(false);
  const jsonRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<EmailInlineEditorHandle>(null);
  const [draftTo, setDraftTo] = useState(sendDraft?.jwtEmail ?? '');
  const [feedback, setFeedback] = useState<Record<string, ActionFeedbackState | null>>({});
  const subject = draft.subject || inboxFallback?.subject || '';
  const preheader = draft.preheader || inboxFallback?.preheader || '';
  const composed = useComposedEmail({ document: draft.document, head, preheader });
  const samples = useMemo(() => sampleValues(variables, { assetsUrl }), [variables, assetsUrl]);
  const previewHtml = composed.html ? fillSampleData(composed.html, samples, { html: true }) : null;

  // Documents written here keep the editor mounted. Any other document (JSON
  // paste, start over, first load) remounts it with that content.
  const ownDocuments = useRef(new WeakSet<EmailDocument>());
  const editorRevision = useRef(0);
  if (!ownDocuments.current.has(draft.document)) {
    ownDocuments.current.add(draft.document);
    editorRevision.current += 1;
  }
  const editorKey = `${editorRevision.current}:${head.length}:${documentKey}`;

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

  function patch(next: Partial<EmailDraft>) {
    setFeedback({});
    onChange({ ...draft, ...next });
  }

  function editDocument(document: EmailDocument) {
    ownDocuments.current.add(document);
    patch({ document });
  }

  function resetJson() {
    setJsonText(
      templateJsonText({
        subject: draft.subject,
        preheader: draft.preheader,
        document: draft.document,
      }),
    );
    setJsonError(null);
    setJsonCopied(false);
  }

  function switchMode(next: EditorMode) {
    if (next === 'json') resetJson();
    setMode(next);
  }

  const [shownKey, setShownKey] = useState(documentKey);
  if (shownKey !== documentKey) {
    setShownKey(documentKey);
    if (mode === 'json') resetJson();
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
    patch({
      subject: parsed.value.subject ?? draft.subject,
      preheader: parsed.value.preheader ?? draft.preheader,
      document: parsed.value.document,
    });
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
    if (error.code === 'invalid_field') {
      return t('emailJsonError_invalid_field', { field: error.field });
    }
    return t(`emailJsonError_${error.code}`);
  }

  async function runAction(name: string, action: () => Promise<boolean | void>, doneText: string) {
    setFeedback({});
    try {
      const completed = await action();
      if (completed !== false) setFeedback({ [name]: { tone: 'success', text: doneText } });
    } catch (err) {
      setFeedback({ [name]: feedbackFromError(t, err) });
    }
  }

  function rememberFocus(field: InboxField, element: HTMLInputElement) {
    setFocus({ field, start: element.selectionStart ?? 0, end: element.selectionEnd ?? 0 });
  }

  function insertVariable(token: string) {
    const placeholder = formatEmailPlaceholder(token);
    if (!focus || focus.field === 'body') {
      editorRef.current?.insertText(placeholder);
      return;
    }
    const next = insertAtSelection(draft[focus.field], focus.start, focus.end, placeholder);
    patch({ [focus.field]: next.value });
    setFocus({ ...focus, start: next.caret, end: next.caret });
  }

  const inboxField = (field: InboxField, label: string) => {
    const fallback = inboxFallback?.[field] ?? '';
    const usesFallback = Boolean(fallback) && !draft[field];
    return (
      <div className="space-y-2">
        <Label htmlFor={`email-${field}`}>{label}</Label>
        <Input
          id={`email-${field}`}
          value={draft[field]}
          readOnly={readOnly}
          placeholder={fallback || undefined}
          aria-describedby={usesFallback ? `email-${field}-fallback` : undefined}
          className={cn(usesFallback && 'border-dashed border-amber-500/70 bg-amber-500/5')}
          onChange={(event) => patch({ [field]: event.target.value })}
          onSelect={(event) => rememberFocus(field, event.currentTarget)}
          onBlur={(event) => rememberFocus(field, event.currentTarget)}
        />
        {usesFallback ? (
          <Text
            id={`email-${field}-fallback`}
            className="text-xs text-amber-700 dark:text-amber-300"
          >
            {inboxFallback?.hint}
          </Text>
        ) : null}
        {literalBeside(field) ? (
          <Text className="font-mono text-xs text-destructive">{literalBeside(field)}</Text>
        ) : null}
      </div>
    );
  };

  const editPane = (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold tracking-tight">{t('emailInboxSection')}</h2>
        {inboxField('subject', t('emailSubjectLabel'))}
        {inboxField('preheader', t('emailPreheaderLabel'))}
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
            head={head}
            assetsUrl={assetsUrl}
            variables={variables}
            label={t('emailContentSection')}
            highlights={highlights}
            onChange={editDocument}
            onFocus={() => setFocus({ field: 'body' })}
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
        readOnly={readOnly}
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
      failed={composed.failed}
      subject={fillSampleData(subject, samples, { html: false })}
      preheader={fillSampleData(preheader, samples, { html: false })}
      large={mode === 'preview'}
    />
  );

  const modes = [
    ...(readOnly ? [] : [{ value: 'edit' as const, label: t('emailModeEdit'), icon: <Pencil /> }]),
    { value: 'preview' as const, label: t('emailModePreview'), icon: <Eye /> },
    { value: 'json' as const, label: t('emailModeJson'), icon: <Braces /> },
  ];

  const actionButton = (
    name: string,
    action: EmailEditorAction,
    variant?: 'outline',
  ): ReactNode => (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        disabled={action.busy || action.disabled}
        onClick={() => void runAction(name, action.run, action.doneText)}
      >
        {action.label}
      </Button>
      <ActionFeedback feedback={feedback[name] ?? null} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-2 shadow-sm">
        <SegmentedControl
          label={t('emailEditorModes')}
          value={mode}
          onChange={switchMode}
          options={modes}
        />
        {languageBar}
      </div>
      {languageNotice}

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

      {primary || secondary || sendDraft ? (
        <div className="space-y-4 border-t border-border/80 pt-4">
          <div className="flex flex-wrap items-start gap-4">
            {primary ? actionButton('primary', primary) : null}
            {secondary ? actionButton('secondary', secondary, 'outline') : null}
            {sendDraft ? (
              <div className="space-y-2">
                <EmailSendDraftAction
                  isStaff={sendDraft.isStaff}
                  jwtEmail={sendDraft.jwtEmail}
                  to={draftTo}
                  sending={sendDraft.sending}
                  onToChange={(value) => {
                    setFeedback({});
                    setDraftTo(value);
                  }}
                  onSend={() =>
                    void runAction(
                      'send',
                      () => sendDraft.run(sendDraft.isStaff ? draftTo.trim() : undefined),
                      t('emailSendDraftSent'),
                    )
                  }
                />
                <ActionFeedback feedback={feedback.send ?? null} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
