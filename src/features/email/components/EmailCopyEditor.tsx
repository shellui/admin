import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { EmailLibraryGrid } from '@/features/email/components/EmailLibraryGrid';
import {
  EmailTemplateEditor,
  type EmailDraft,
} from '@/features/email/components/EmailTemplateEditor';
import type { EmailApiClient } from '@/lib/emailApi';
import { emailErrorText } from '@/lib/emailApiErrors';
import { validateAuthLaneOverride } from '@/lib/emailAuthTemplate';
import { emptyEmailDocument } from '@/lib/emailDocument';
import { emailAssetsUrl } from '@/lib/emailLibrary';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import type { EmailCatalogEvent, EmailLibrary, EmailTemplateRow } from '@/lib/emailTypes';

const EMPTY_DRAFT: EmailDraft = { subject: '', preheader: '', document: emptyEmailDocument() };

/** The editable copy an event email sends: edit, publish, send a draft, or start over. */
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [row, setRow] = useState<EmailTemplateRow | null>(null);
  const [event, setEvent] = useState<EmailCatalogEvent | null>(null);
  const [authLinkHosts, setAuthLinkHosts] = useState<string[]>([]);
  const [draft, setDraft] = useState<EmailDraft>(EMPTY_DRAFT);
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
        setRow(nextRow);
        setEvent(nextEvent);
        setAuthLinkHosts(catalog.authLinkHosts);
        setDraft(
          latest
            ? { subject: latest.subject, preheader: latest.preheader, document: latest.document }
            : EMPTY_DRAFT,
        );
        setUnpublished(Boolean(latest && latest.state === 'draft'));
        onLoadedRef.current?.(nextRow, nextEvent);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [api, templateId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const laneClass = event?.laneClass ?? '';
  const variables = event?.variables ?? [];

  function checkAuth() {
    const issue = validateAuthLaneOverride({
      laneClass,
      variables,
      authLinkHosts,
      subject: draft.subject,
      preheader: draft.preheader,
      document: draft.document,
    });
    if (issue) throw issue;
  }

  async function publish() {
    checkAuth();
    setPublishing(true);
    try {
      const version = await api.createVersion(templateId, draft);
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
      await api.sendTemplateTest(templateId, { ...draft, ...(to ? { to } : {}) });
    } finally {
      setSending(false);
    }
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
        onChange={(next) => setDraft(next)}
      />
    </div>
  );
}
