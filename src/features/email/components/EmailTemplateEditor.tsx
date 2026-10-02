import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/contexts/ThemeContext';
import {
  EMAIL_BLOCK_TYPES,
  formatEmailPlaceholder,
  insertAtSelection,
  renderEmailPreviewHtml,
  type EmailBlock,
  type EmailDocument,
  type EmailLang,
  type EmailVariable,
} from '@/lib/emailDocument';
import { emailErrorText } from '@/lib/emailApiErrors';
import { requiredAuthLinkTokens, validateAuthLaneOverride } from '@/lib/emailAuthTemplate';
import {
  availableThemeNamesKey,
  getAppearanceAvailableThemes,
  paletteForThemeName,
  resolveEmailThemeName,
  themePalettePayload,
} from '@/lib/emailTheme';

export type EmailLangDraft = {
  subject: string;
  preheader: string;
  document: EmailDocument;
  templateId: number | null;
};

type FocusTarget = {
  lang: EmailLang;
  field: string;
  start: number;
  end: number;
};

function updateBlock(
  document: EmailDocument,
  index: number,
  patch: Partial<EmailBlock>,
): EmailDocument {
  return {
    ...document,
    blocks: document.blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)),
  };
}

export function EmailTemplateEditor({
  templateKey,
  laneClass,
  authLinkHosts,
  storedThemeName,
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
  onServicePreview,
  servicePreviewHtml,
  servicePreviewNote,
}: {
  templateKey: string;
  laneClass: string;
  authLinkHosts: string[];
  storedThemeName: string | null;
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
  onPublish: (themeName: string | null, themePalette: Record<string, string>) => void;
  onReset: () => void;
  onSendDraft: (
    lang: EmailLang,
    draft: EmailLangDraft,
    themePalette: Record<string, string>,
    to?: string,
  ) => void;
  onServicePreview: (
    lang: EmailLang,
    draft: EmailLangDraft,
    themePalette: Record<string, string>,
  ) => void;
  servicePreviewHtml: string | null;
  servicePreviewNote: string | null;
}) {
  const { t } = useTranslation();
  const appearance = useTheme();
  const themes = useMemo(() => getAppearanceAvailableThemes(appearance), [appearance]);
  const themeKey = availableThemeNamesKey(themes);
  const [themeName, setThemeName] = useState<string | null>(() =>
    resolveEmailThemeName(storedThemeName ?? undefined, appearance, themes),
  );
  const [lang, setLang] = useState<EmailLang>('en');
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [showService, setShowService] = useState(false);
  const [draftTo, setDraftTo] = useState(jwtEmail ?? '');

  const draft = lang === 'fr' ? draftFr : draftEn;
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
  const resolvedTheme = resolveEmailThemeName(themeName ?? undefined, appearance, themes);
  const palette = paletteForThemeName(resolvedTheme, appearance, themes);
  const themedHtml = renderEmailPreviewHtml(draft.document, palette);
  const previewHtml = showService && servicePreviewHtml ? servicePreviewHtml : themedHtml;

  function patch(next: Partial<EmailLangDraft>) {
    onChange(lang, { ...draft, ...next });
  }

  function rememberFocus(field: string, element: HTMLInputElement | HTMLTextAreaElement) {
    setFocus({ lang, field, start: element.selectionStart ?? 0, end: element.selectionEnd ?? 0 });
  }

  function insertVariable(token: string) {
    const placeholder = formatEmailPlaceholder(token);
    if (!focus || focus.lang !== lang) {
      patch({ subject: `${draft.subject}${placeholder}` });
      return;
    }
    if (focus.field === 'subject') {
      const next = insertAtSelection(draft.subject, focus.start, focus.end, placeholder);
      patch({ subject: next.value });
      setFocus({ ...focus, start: next.caret, end: next.caret });
      return;
    }
    if (focus.field === 'preheader') {
      const next = insertAtSelection(draft.preheader, focus.start, focus.end, placeholder);
      patch({ preheader: next.value });
      setFocus({ ...focus, start: next.caret, end: next.caret });
      return;
    }
    if (focus.field === 'preview') {
      const next = insertAtSelection(draft.document.preview, focus.start, focus.end, placeholder);
      patch({ document: { ...draft.document, preview: next.value } });
      setFocus({ ...focus, start: next.caret, end: next.caret });
      return;
    }
    const match = /^block:(\d+):(text|href)$/.exec(focus.field);
    if (!match) return;
    const index = Number(match[1]);
    const key = match[2] as 'text' | 'href';
    const block = draft.document.blocks[index];
    if (!block) return;
    const current = key === 'href' ? (block.href ?? '') : block.text;
    const next = insertAtSelection(current, focus.start, focus.end, placeholder);
    patch({ document: updateBlock(draft.document, index, { [key]: next.value }) });
    setFocus({ ...focus, start: next.caret, end: next.caret });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex gap-2"
            role="tablist"
            aria-label={t('emailLanguageTabs')}
          >
            {(['en', 'fr'] as const).map((code) => (
              <Button
                key={code}
                type="button"
                size="sm"
                variant={lang === code ? 'default' : 'outline'}
                onClick={() => {
                  setLang(code);
                  setShowService(false);
                }}
              >
                {code === 'en' ? t('emailLangEn') : t('emailLangFr')}
              </Button>
            ))}
          </div>
          {themes.length ? (
            <label className="flex items-center gap-2 text-sm">
              <span>{t('emailThemeLabel')}</span>
              <select
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                aria-label={t('emailThemeLabel')}
                value={resolvedTheme ?? ''}
                data-themes={themeKey}
                onChange={(event) => setThemeName(event.target.value)}
              >
                {themes.map((theme) => (
                  <option
                    key={theme.name}
                    value={theme.name}
                  >
                    {theme.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
        <Text className="font-mono text-xs">{t('emailEditorThemeNote')}</Text>

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
            <Text className="font-mono text-xs text-destructive">{literalBeside('preheader')}</Text>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-preview-text">{t('emailPreviewLabel')}</Label>
          <Input
            id="email-preview-text"
            value={draft.document.preview}
            onChange={(event) =>
              patch({ document: { ...draft.document, preview: event.target.value } })
            }
            onSelect={(event) => rememberFocus('preview', event.currentTarget)}
            onBlur={(event) => rememberFocus('preview', event.currentTarget)}
          />
          {literalBeside('preview') ? (
            <Text className="font-mono text-xs text-destructive">{literalBeside('preview')}</Text>
          ) : null}
        </div>

        {variables.length ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('emailVariablesLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {variables.map((variable) => (
                <button
                  key={variable.token}
                  type="button"
                  className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs hover:bg-muted"
                  title={variable.example}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertVariable(variable.token)}
                >
                  {variable.token}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {literalBeside('document') ? (
          <Text className="font-mono text-xs text-destructive">{literalBeside('document')}</Text>
        ) : null}
        <ol className="space-y-3">
          {draft.document.blocks.map((block, index) => (
            <li
              key={`${lang}-${index}`}
              className="space-y-2 rounded-md border border-border/80 p-3"
            >
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label={t('emailBlockType')}
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  value={block.type}
                  onChange={(event) =>
                    patch({
                      document: updateBlock(draft.document, index, {
                        type: event.target.value as EmailBlock['type'],
                      }),
                    })
                  }
                >
                  {EMAIL_BLOCK_TYPES.map((type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {t(`emailBlock_${type}`)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (index === 0) return;
                    const blocks = [...draft.document.blocks];
                    const [item] = blocks.splice(index, 1);
                    blocks.splice(index - 1, 0, item);
                    patch({ document: { ...draft.document, blocks } });
                  }}
                >
                  {t('emailMoveUp')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (index >= draft.document.blocks.length - 1) return;
                    const blocks = [...draft.document.blocks];
                    const [item] = blocks.splice(index, 1);
                    blocks.splice(index + 1, 0, item);
                    patch({ document: { ...draft.document, blocks } });
                  }}
                >
                  {t('emailMoveDown')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch({
                      document: {
                        ...draft.document,
                        blocks: draft.document.blocks.filter((_, i) => i !== index),
                      },
                    })
                  }
                >
                  {t('emailRemoveBlock')}
                </Button>
              </div>
              <textarea
                aria-label={t('emailBlockText')}
                className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={block.text}
                onChange={(event) =>
                  patch({
                    document: updateBlock(draft.document, index, { text: event.target.value }),
                  })
                }
                onSelect={(event) => rememberFocus(`block:${index}:text`, event.currentTarget)}
                onBlur={(event) => rememberFocus(`block:${index}:text`, event.currentTarget)}
              />
              {block.type === 'button' ? (
                <Input
                  aria-label={t('emailBlockHref')}
                  value={block.href ?? ''}
                  onChange={(event) =>
                    patch({
                      document: updateBlock(draft.document, index, { href: event.target.value }),
                    })
                  }
                  onSelect={(event) => rememberFocus(`block:${index}:href`, event.currentTarget)}
                  onBlur={(event) => rememberFocus(`block:${index}:href`, event.currentTarget)}
                />
              ) : null}
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            patch({
              document: {
                ...draft.document,
                blocks: [...draft.document.blocks, { type: 'text', text: '' }],
              },
            })
          }
        >
          {t('emailAddBlock')}
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={publishing}
            onClick={() => onPublish(resolvedTheme, themePalettePayload(palette))}
          >
            {publishing ? t('emailPublishing') : t('emailPublish')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={resetting || !hasCompanyTemplate}
            onClick={onReset}
          >
            {t('emailReset')}
          </Button>
        </div>
        <div className="space-y-2 border-t border-border/80 pt-4">
          <h2 className="text-base font-semibold tracking-tight">{t('emailSendDraft')}</h2>
          <Text>{isStaff ? t('emailSendDraftStaffHint') : t('emailSendDraftOwnerHint')}</Text>
          <div className="flex flex-wrap items-end gap-2">
            {isStaff ? (
              <div className="min-w-[16rem] flex-1 space-y-2">
                <Label htmlFor="email-draft-to">{t('emailTestTo')}</Label>
                <Input
                  id="email-draft-to"
                  type="email"
                  value={draftTo}
                  onChange={(event) => setDraftTo(event.target.value)}
                />
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={sendingDraft || (isStaff && !draftTo.trim())}
              onClick={() =>
                onSendDraft(
                  lang,
                  draft,
                  themePalettePayload(palette),
                  isStaff ? draftTo.trim() : undefined,
                )
              }
            >
              {sendingDraft ? t('emailTestSending') : t('emailSendDraft')}
            </Button>
          </div>
        </div>
        <Text className="font-mono text-xs">{templateKey}</Text>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">{t('emailPreview')}</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setShowService(true);
              onServicePreview(lang, draft, themePalettePayload(palette));
            }}
          >
            {t('emailPreviewService')}
          </Button>
        </div>
        <Text>{showService ? t('emailPreviewServiceNote') : t('emailPreviewThemed')}</Text>
        {servicePreviewNote ? (
          <Text className="font-mono text-xs">{servicePreviewNote}</Text>
        ) : null}
        <iframe
          title={t('emailPreview')}
          sandbox=""
          srcDoc={previewHtml}
          className="h-[32rem] w-full rounded-md border border-border bg-white"
        />
      </div>
    </div>
  );
}
