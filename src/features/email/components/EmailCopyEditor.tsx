import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useLang } from '@/contexts/LangContext';
import {
  EmailLanguageTabs,
  EmailTranslationNotice,
} from '@/features/email/components/EmailLanguageBar';
import { EmailLibraryGrid } from '@/features/email/components/EmailLibraryGrid';
import {
  EmailTemplateEditor,
  type EmailDraft,
} from '@/features/email/components/EmailTemplateEditor';
import type { EmailApiClient } from '@/lib/emailApi';
import { emailErrorText } from '@/lib/emailApiErrors';
import { validateAuthLaneOverride } from '@/lib/emailAuthTemplate';
import { emptyEmailDocument, type EmailDocument, type EmailLang } from '@/lib/emailDocument';
import { emailAssetsUrl } from '@/lib/emailLibrary';
import {
  EMAIL_LANGS,
  applyTranslatedEdit,
  isEmailLang,
  localizeDocument,
  markTranslationCurrent,
  pruneTranslations,
  translationStatus,
  withAllLanguages,
  withTextIds,
  type EmailInbox,
  type EmailTranslationStatus,
  type EmailTranslations,
} from '@/lib/emailTranslations';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import type { EmailTheme } from '@/lib/emailThemes';
import { useEmailThemes } from '@/features/email/useEmailThemes';
import type { EmailCatalogEvent, EmailLibrary, EmailTemplateRow } from '@/lib/emailTypes';

const EMPTY_INBOX: EmailInbox = { subject: '', preheader: '' };

function eventLanguages(event: EmailCatalogEvent | null): EmailLang[] {
  const offered = Object.keys(event?.suggested ?? {});
  const languages = EMAIL_LANGS.filter((lang) => offered.includes(lang));
  return languages.length ? languages : EMAIL_LANGS;
}

/**
 * The editable copy an event email sends, in every language: one layout, text
 * per language. Opens in the Shellui language. Edit, publish, send a draft, or
 * start over.
 */
export function EmailCopyEditor({
  api,
  baseUrl,
  templateId,
  isStaff,
  jwtEmail,
  onLoaded,
}: {
  api: EmailApiClient;
  baseUrl: string;
  templateId: number;
  isStaff: boolean;
  jwtEmail: string | null;
  onLoaded?: (row: EmailTemplateRow, event: EmailCatalogEvent | null) => void;
}) {
  const { t } = useTranslation();
  const shellLang = useLang();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [row, setRow] = useState<EmailTemplateRow | null>(null);
  const [event, setEvent] = useState<EmailCatalogEvent | null>(null);
  const [authLinkHosts, setAuthLinkHosts] = useState<string[]>([]);
  const [mainLang, setMainLang] = useState<EmailLang>('en');
  const [lang, setLang] = useState<EmailLang | null>(null);
  const [base, setBase] = useState<EmailDocument>(emptyEmailDocument);
  const [mainInbox, setMainInbox] = useState<EmailInbox>(EMPTY_INBOX);
  const [translations, setTranslations] = useState<EmailTranslations>({});
  const [theme, setTheme] = useState<EmailTheme | null>(null);
  const emailThemes = useEmailThemes();
  // The document the editor last wrote in a translation, so typing keeps it mounted.
  const view = useRef<{ lang: EmailLang; document: EmailDocument } | null>(null);
  const [unpublished, setUnpublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [library, setLibrary] = useState<EmailLibrary | null>(null);
  const [picking, setPicking] = useState(false);
  const [startingOver, setStartingOver] = useState(false);
  const [pickError, setPickError] = useState<unknown>(null);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const [nextRow, catalog, versions] = await Promise.all([
          api.fetchTemplate(templateId),
          api.fetchCatalog(),
          api.fetchVersions(templateId),
        ]);
        const nextEvent =
          catalog.events.find((item) => item.eventType === nextRow.eventType) ?? null;
        const latest = versions.reduce<(typeof versions)[number] | null>(
          (best, version) => (!best || version.number > best.number ? version : best),
          null,
        );
        const nextMain = isEmailLang(nextRow.language) ? nextRow.language : 'en';
        const document = withTextIds(latest?.document ?? emptyEmailDocument());
        const inbox = latest
          ? { subject: latest.subject, preheader: latest.preheader }
          : EMPTY_INBOX;
        setRow(nextRow);
        setEvent(nextEvent);
        setAuthLinkHosts(catalog.authLinkHosts);
        setMainLang(nextMain);
        setBase(document);
        setMainInbox(inbox);
        setTheme(latest?.theme ?? null);
        setTranslations(
          withAllLanguages(
            pruneTranslations(document, latest?.translations ?? {}),
            nextMain,
            inbox,
            nextEvent?.suggested ?? {},
          ),
        );
        view.current = null;
        const languages = eventLanguages(nextEvent);
        setLang((current) => current ?? (languages.includes(shellLang) ? shellLang : nextMain));
        setUnpublished(Boolean(latest && latest.state === 'draft'));
        onLoadedRef.current?.(nextRow, nextEvent);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    // The Shellui language only picks the first tab, so it does not reload.
    [api, templateId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const laneClass = event?.laneClass ?? '';
  const variables = event?.variables ?? [];
  const languages = useMemo(() => eventLanguages(event), [event]);
  const current = lang ?? mainLang;
  const translation = current === mainLang ? undefined : translations[current];
  const mainName = t(`emailLangInline_${mainLang}`);

  let draft: EmailDraft;
  if (!translation) {
    view.current = null;
    draft = { ...mainInbox, document: base };
  } else {
    if (view.current?.lang !== current) {
      view.current = { lang: current, document: localizeDocument(base, translation) };
    }
    draft = {
      subject: translation.subject,
      preheader: translation.preheader,
      document: view.current.document,
    };
  }

  const status = useMemo(() => {
    const out: Partial<Record<EmailLang, EmailTranslationStatus>> = {};
    for (const item of languages) {
      if (item !== mainLang) out[item] = translationStatus(base, translations[item], mainInbox);
    }
    return out;
  }, [base, translations, mainInbox, mainLang, languages]);
  const currentStatus = translation ? status[current] : undefined;

  const highlights = useMemo(
    () =>
      currentStatus
        ? {
            missing: currentStatus.missing,
            outdated: currentStatus.outdated,
            missingTitle: t('emailTranslationMissingTitle', { main: mainName }),
            outdatedTitle: t('emailTranslationOutdatedTitle', { main: mainName }),
          }
        : null,
    [currentStatus, mainName, t],
  );

  function change(next: EmailDraft) {
    if (!translation) {
      setBase(next.document);
      setMainInbox({ subject: next.subject, preheader: next.preheader });
      setTranslations((prev) => pruneTranslations(next.document, prev));
      return;
    }
    const result = applyTranslatedEdit(base, translation, next.document);
    view.current = { lang: current, document: next.document };
    setBase(result.base);
    setTranslations((prev) =>
      pruneTranslations(result.base, {
        ...prev,
        [current]: { ...result.translation, subject: next.subject, preheader: next.preheader },
      }),
    );
  }

  /** Each language as it sends: its text, or the main text where it has none. */
  function variantsToSend(): Array<{ lang: EmailLang; document: EmailDocument } & EmailInbox> {
    return languages.map((item) => {
      const entry = item === mainLang ? undefined : translations[item];
      return {
        lang: item,
        document: localizeDocument(base, entry),
        subject: entry?.subject || mainInbox.subject,
        preheader: entry?.preheader || mainInbox.preheader,
      };
    });
  }

  /** Opens the language at fault, so the error shows beside it. */
  function checkAuth() {
    for (const variant of variantsToSend()) {
      const issue = validateAuthLaneOverride({ laneClass, variables, authLinkHosts, ...variant });
      if (issue) {
        setLang(variant.lang);
        throw issue;
      }
    }
  }

  async function publish() {
    checkAuth();
    setPublishing(true);
    try {
      const version = await api.createVersion(templateId, {
        ...mainInbox,
        document: base,
        translations,
        theme: theme ?? {},
      });
      await api.publishVersion(templateId, version.number);
      await load({ silent: true });
    } finally {
      setPublishing(false);
    }
  }

  async function sendDraft(to?: string) {
    checkAuth();
    setSending(true);
    try {
      await api.sendTemplateTest(templateId, {
        document: draft.document,
        subject: draft.subject || mainInbox.subject,
        preheader: draft.preheader || mainInbox.preheader,
        ...(theme ? { theme } : {}),
        ...(to ? { to } : {}),
      });
    } finally {
      setSending(false);
    }
  }

  function markCurrent() {
    setTranslations((prev) => {
      const entry = prev[current];
      return entry ? { ...prev, [current]: markTranslationCurrent(base, entry) } : prev;
    });
  }

  async function openPicker() {
    setPicking(true);
    setPickError(null);
    if (library) return false;
    try {
      setLibrary(await api.fetchLibrary());
    } catch (err) {
      setPickError(err);
    }
    return false;
  }

  async function startOver(libraryId: number, name: string) {
    const confirmed = await askShelluiConfirm({
      title: t('emailStartOverTitle'),
      description: t('emailStartOverDescription', { name }),
      okLabel: t('emailStartOverConfirm'),
      cancelLabel: t('actionsCancel'),
    });
    if (!confirmed) return;
    setStartingOver(true);
    setPickError(null);
    try {
      await api.createVersion(templateId, { library_id: libraryId });
      setPicking(false);
      await load({ silent: true });
    } catch (err) {
      setPickError(err);
    } finally {
      setStartingOver(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t('emailLoading')}
      </div>
    );
  }
  if (error || !row) {
    return <Text className="font-mono text-sm text-destructive">{emailErrorText(t, error)}</Text>;
  }

  const assetsUrl = emailAssetsUrl(baseUrl);

  return (
    <div className="space-y-5">
      {unpublished ? <Text className="text-sm">{t('emailCopyUnpublished')}</Text> : null}
      {picking ? (
        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight">{t('emailStartOverPick')}</h2>
              <Text className="text-xs">{t('emailStartOverHint')}</Text>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPicking(false)}
            >
              {t('actionsCancel')}
            </Button>
          </div>
          {pickError ? (
            <Text className="font-mono text-sm text-destructive">
              {emailErrorText(t, pickError)}
            </Text>
          ) : null}
          {library ? (
            <EmailLibraryGrid
              library={library}
              assetsUrl={assetsUrl}
              selectedId={null}
              onSelect={(template) => {
                if (!startingOver) void startOver(template.id, template.name);
              }}
            />
          ) : pickError ? null : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('emailLoading')}
            </div>
          )}
        </section>
      ) : null}
      <EmailTemplateEditor
        laneClass={laneClass}
        authLinkHosts={authLinkHosts}
        head={row.head}
        assetsUrl={assetsUrl}
        draft={draft}
        documentKey={current}
        variables={variables}
        primary={{
          label: publishing ? t('emailPublishing') : t('emailPublish'),
          busy: publishing,
          run: publish,
          doneText: t('emailPublished'),
        }}
        secondary={{
          label: t('emailStartOver'),
          disabled: picking || startingOver,
          run: openPicker,
          doneText: '',
        }}
        sendDraft={{ isStaff, jwtEmail, sending, run: sendDraft }}
        languageBar={
          languages.length > 1 ? (
            <EmailLanguageTabs
              languages={languages}
              mainLang={mainLang}
              value={current}
              status={status}
              onChange={setLang}
            />
          ) : null
        }
        languageNotice={
          currentStatus ? (
            <EmailTranslationNotice
              lang={current}
              mainLang={mainLang}
              status={currentStatus}
              onMarkCurrent={markCurrent}
            />
          ) : null
        }
        inboxFallback={
          translation
            ? { ...mainInbox, hint: t('emailInboxFallback', { main: mainName }) }
            : undefined
        }
        highlights={highlights}
        theme={{ value: theme, themes: emailThemes.themes, onChange: setTheme }}
        onChange={change}
      />
    </div>
  );
}
