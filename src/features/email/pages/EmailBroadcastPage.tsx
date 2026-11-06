import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Send, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { BroadcastAudienceBuilder } from '@/features/email/components/BroadcastAudienceBuilder';
import {
  BroadcastCountsGrid,
  BroadcastStateBadge,
} from '@/features/email/components/BroadcastStatus';
import { EmailCopyEditor } from '@/features/email/components/EmailCopyEditor';
import { SegmentedControl } from '@/features/email/components/SegmentedControl';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { confirmAction } from '@/lib/confirmAction';
import { EmailApiError, emailErrorText } from '@/lib/emailApiErrors';
import {
  broadcastIsActive,
  senderOnSubdomain,
  type Broadcast,
  type BroadcastAudience,
  type BroadcastPreview,
} from '@/lib/emailBroadcasts';
import type { Newsletter } from '@/lib/emailNewsletters';
import { getEmailFromJwt, getIsStaffFromJwt } from '@/lib/jwtCompany';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';

type Tab = 'content' | 'audience' | 'send';

const POLL_MS = 4000;
const PREVIEW_DELAY_MS = 500;

function sameAudience(a: BroadcastAudience, b: BroadcastAudience): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function PreviewSummary({
  preview,
  loading,
  error,
}: {
  preview: BroadcastPreview | null;
  loading: boolean;
  error: unknown;
}) {
  const { t } = useTranslation();
  if (error) {
    return (
      <p
        className="font-mono text-sm text-destructive"
        role="alert"
      >
        {emailErrorText(t, error)}
      </p>
    );
  }
  if (!preview) {
    return loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null;
  }
  const languages = Object.entries(preview.languages).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-center gap-2">
        <span className="font-heading text-2xl font-semibold tabular-nums">{preview.sendable}</span>
        <span>{t('emailBroadcastPreviewSendable', { count: preview.sendable })}</span>
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      </p>
      {languages.length ? (
        <ul className="flex flex-wrap gap-2">
          {languages.map(([language, count]) => (
            <li
              key={language}
              className="rounded-md border border-border px-2 py-0.5 text-xs"
            >
              {t(`emailLangInline_${language}`, { defaultValue: language })}{' '}
              <span className="font-mono tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {preview.unsubscribed || preview.suppressed ? (
        <Text className="text-xs">
          {t('emailBroadcastPreviewSkipped', {
            unsubscribed: preview.unsubscribed,
            suppressed: preview.suppressed,
          })}
        </Text>
      ) : null}
      {preview.samples.length ? (
        <Text className="font-mono text-xs">{preview.samples.join(', ')}</Text>
      ) : null}
    </div>
  );
}

export function EmailBroadcastPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const broadcastId = Number(params.broadcastId);
  const accessToken = useShelluiAccessToken();
  const { api, baseUrl, canManage } = useEmailApi(accessToken);
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [tab, setTab] = useState<Tab>('content');
  const [name, setName] = useState('');
  const [audience, setAudience] = useState<BroadcastAudience | null>(null);
  const [preview, setPreview] = useState<BroadcastPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [unpublished, setUnpublished] = useState(false);
  const [newsletters, setNewsletters] = useState<Newsletter[] | null>(null);
  const [busy, setBusy] = useState<'save' | 'send' | 'delete' | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedbackState | null>(null);

  const apply = useCallback((next: Broadcast) => {
    setBroadcast(next);
    setName(next.name);
    setAudience((current) => current ?? next.audience);
  }, []);

  useEffect(() => {
    if (!api || !canManage || !Number.isFinite(broadcastId)) return;
    let cancelled = false;
    api
      .fetchBroadcast(broadcastId)
      .then((next) => {
        if (cancelled) return;
        apply(next);
        if (next.state !== 'draft') setTab('send');
      })
      .catch((err) => !cancelled && setLoadError(err));
    return () => {
      cancelled = true;
    };
  }, [api, canManage, broadcastId, apply]);

  const active = broadcast ? broadcastIsActive(broadcast) : false;
  useEffect(() => {
    if (!api || !active) return;
    const timer = window.setInterval(() => {
      void api
        .fetchBroadcast(broadcastId)
        .then(apply)
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [api, active, broadcastId, apply]);

  const isDraft = broadcast?.state === 'draft';
  useEffect(() => {
    if (!api || !isDraft || tab !== 'audience' || newsletters) return;
    let cancelled = false;
    api
      .fetchNewsletters()
      .then((rows) => !cancelled && setNewsletters(rows))
      .catch(() => !cancelled && setNewsletters([]));
    return () => {
      cancelled = true;
    };
  }, [api, isDraft, tab, newsletters]);

  useEffect(() => {
    if (!api || !audience || !isDraft || tab === 'content') return;
    if (audience.mode === 'newsletter' && !audience.list_id) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const timer = window.setTimeout(() => {
      api
        .previewBroadcast(broadcastId, audience)
        .then((next) => {
          if (cancelled) return;
          setPreview(next);
          setPreviewError(null);
        })
        .catch((err) => !cancelled && setPreviewError(err))
        .finally(() => !cancelled && setPreviewLoading(false));
    }, PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [api, audience, isDraft, tab, broadcastId]);

  useEffect(() => {
    if (!api || !broadcast || !isDraft || tab !== 'send') return;
    let cancelled = false;
    api
      .fetchVersions(broadcast.templateId)
      .then((versions) => {
        if (cancelled) return;
        const latest = versions.reduce((best, v) => (v.number > best ? v.number : best), 0);
        setUnpublished(versions.some((v) => v.number === latest && v.state === 'draft'));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, broadcast, isDraft, tab]);

  const dirty = Boolean(broadcast && audience && !sameAudience(audience, broadcast.audience));

  async function saveName() {
    if (!api || !broadcast || !isDraft) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === broadcast.name) {
      setName(broadcast.name);
      return;
    }
    try {
      apply(await api.patchBroadcast(broadcast.id, { name: trimmed }));
    } catch (err) {
      setFeedback(feedbackFromError(t, err));
      setName(broadcast.name);
    }
  }

  async function saveAudience(): Promise<Broadcast | null> {
    if (!api || !broadcast || !audience) return null;
    const saved = await api.patchBroadcast(broadcast.id, { audience });
    setBroadcast(saved);
    setAudience(saved.audience);
    return saved;
  }

  async function runSave() {
    setBusy('save');
    setFeedback(null);
    try {
      await saveAudience();
      setFeedback({ tone: 'success', text: t('emailBroadcastAudienceSaved') });
    } catch (err) {
      setFeedback(feedbackFromError(t, err));
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!api || !broadcast || !preview) return;
    const confirmed = await askShelluiConfirm({
      title: t('emailBroadcastSendTitle'),
      description: t('emailBroadcastSendDescription', {
        count: preview.sendable,
        name: broadcast.name,
      }),
      okLabel: t('emailBroadcastSendConfirm'),
      cancelLabel: t('actionsCancel'),
    });
    if (!confirmed) return;
    setBusy('send');
    setFeedback(null);
    try {
      if (dirty) await saveAudience();
      apply(await api.sendBroadcast(broadcast.id));
    } catch (err) {
      setFeedback(feedbackFromError(t, err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!api || !broadcast) return;
    const ok = await confirmAction({
      title: t('emailBroadcastDeleteTitle'),
      description: t('emailBroadcastDeleteDescription', { name: broadcast.name }),
      okLabel: t('emailBroadcastDelete'),
      cancelLabel: t('actionsCancel'),
      danger: true,
    });
    if (!ok) return;
    setBusy('delete');
    try {
      await api.deleteBroadcast(broadcast.id);
      navigate('/email/broadcasts');
    } catch (err) {
      setFeedback(feedbackFromError(t, err));
      setBusy(null);
    }
  }

  const sender = broadcast?.sender ?? null;
  const tabs: Array<{ value: Tab; label: string }> = isDraft
    ? [
        { value: 'content', label: t('emailBroadcastTabContent') },
        { value: 'audience', label: t('emailBroadcastTabAudience') },
        { value: 'send', label: t('emailBroadcastTabSend') },
      ]
    : [];

  return (
    <div className="w-full space-y-6">
      <header className="space-y-3">
        <Link
          to="/email/broadcasts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft
            aria-hidden
            className="size-4"
          />
          {t('emailBroadcastBack')}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            {isDraft ? (
              <Input
                aria-label={t('emailBroadcastName')}
                className="h-auto max-w-full border-transparent bg-transparent px-1 field-sizing-content font-heading text-2xl font-semibold tracking-tight shadow-none hover:border-input focus-visible:border-input md:text-3xl"
                value={name}
                maxLength={120}
                onChange={(ev) => setName(ev.target.value)}
                onBlur={() => void saveName()}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') ev.currentTarget.blur();
                }}
              />
            ) : (
              <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
                {broadcast?.name ?? t('emailBroadcastsTitle')}
              </h1>
            )}
            <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              email-service
            </span>
            {broadcast ? <BroadcastStateBadge state={broadcast.state} /> : null}
          </div>
          {isDraft ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy !== null}
              onClick={() => void remove()}
            >
              <Trash2 aria-hidden />
              {t('emailBroadcastDelete')}
            </Button>
          ) : null}
        </div>
      </header>

      {!accessToken ? (
        <Alert variant="info">
          <AlertDescription>{t('dashboardNoSession')}</AlertDescription>
        </Alert>
      ) : null}
      {accessToken && !canManage ? (
        <Alert variant="warning">
          <AlertDescription>{t('emailForbidden')}</AlertDescription>
        </Alert>
      ) : null}
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription className="font-mono text-sm">
            {emailErrorText(t, loadError)}
          </AlertDescription>
        </Alert>
      ) : null}
      {!broadcast && !loadError && canManage ? (
        <div
          className="space-y-3 motion-safe:animate-pulse"
          aria-busy
        >
          <span className="sr-only">{t('emailLoading')}</span>
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : null}

      {broadcast && api && accessToken ? (
        <>
          {tabs.length ? (
            <SegmentedControl
              variant="underline"
              label={t('emailBroadcastsTitle')}
              value={tab}
              options={tabs}
              onChange={(next) => {
                setFeedback(null);
                setTab(next);
              }}
            />
          ) : null}

          {isDraft && tab === 'content' ? (
            <EmailCopyEditor
              api={api}
              baseUrl={baseUrl}
              templateId={broadcast.templateId}
              isStaff={getIsStaffFromJwt(accessToken)}
              jwtEmail={getEmailFromJwt(accessToken)}
            />
          ) : null}

          {isDraft && tab === 'audience' && audience ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="space-y-4 p-4 sm:p-5">
                  <BroadcastAudienceBuilder
                    accessToken={accessToken}
                    value={audience}
                    onChange={setAudience}
                    newsletters={newsletters}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    {dirty ? (
                      <StatusBadge
                        tone="warning"
                        dot
                      >
                        {t('emailBroadcastUnsaved')}
                      </StatusBadge>
                    ) : null}
                    <ActionFeedback feedback={feedback} />
                  </div>
                  <Button
                    type="button"
                    disabled={!dirty || busy !== null}
                    onClick={() => void runSave()}
                  >
                    {busy === 'save' ? (
                      <Loader2 className="animate-spin motion-reduce:animate-none" />
                    ) : null}
                    {t('emailBroadcastSaveAudience')}
                  </Button>
                </div>
              </section>
              <aside className="h-fit space-y-2 rounded-xl border border-border bg-card p-4 shadow-xs">
                <h2 className="text-sm font-semibold">{t('emailBroadcastPreviewTitle')}</h2>
                <PreviewSummary
                  preview={preview}
                  loading={previewLoading}
                  error={previewError}
                />
                <Text className="text-xs">
                  {audience.mode === 'newsletter'
                    ? t('emailBroadcastNewsletterLanguageHint')
                    : t('emailBroadcastLanguageHint')}
                </Text>
              </aside>
            </div>
          ) : null}

          {isDraft && tab === 'send' ? (
            <div className="max-w-3xl space-y-4">
              {unpublished ? (
                <Alert variant="warning">
                  <AlertTitle>{t('emailBroadcastUnpublishedTitle')}</AlertTitle>
                  <AlertDescription>{t('emailBroadcastUnpublished')}</AlertDescription>
                </Alert>
              ) : null}
              <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="space-y-5 p-4 sm:p-5">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold">{t('emailBroadcastSender')}</h2>
                    {sender && !sender.errorCode && !senderOnSubdomain(sender.fromEmail) ? (
                      <p className="text-[13px] text-muted-foreground">
                        {t('emailBroadcastSubdomainHint')}
                      </p>
                    ) : null}
                  </div>
                  {sender?.errorCode ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {emailErrorText(t, new EmailApiError(sender.errorCode, 409))}
                      </AlertDescription>
                    </Alert>
                  ) : sender ? (
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
                      <dt className="text-muted-foreground">{t('emailBroadcastSender')}</dt>
                      <dd className="break-all font-mono">
                        {sender.fromName
                          ? `${sender.fromName} <${sender.fromEmail}>`
                          : sender.fromEmail}
                      </dd>
                      <dt className="text-muted-foreground">{t('emailBroadcastDelivery')}</dt>
                      <dd>{t(`emailBroadcastDelivery_${sender.delivery}`)}</dd>
                    </dl>
                  ) : null}
                  <div className="space-y-1 border-t border-border pt-4">
                    <h2 className="text-sm font-semibold">{t('emailBroadcastTabAudience')}</h2>
                    <PreviewSummary
                      preview={preview}
                      loading={previewLoading}
                      error={previewError}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <Link
                      to="/email/provider"
                      className="text-sm text-primary underline-offset-2 hover:underline"
                    >
                      {t('emailBroadcastOpenProvider')}
                    </Link>
                    <ActionFeedback feedback={feedback} />
                  </div>
                  <Button
                    type="button"
                    disabled={
                      busy !== null ||
                      Boolean(sender?.errorCode) ||
                      !preview ||
                      preview.sendable === 0 ||
                      previewLoading
                    }
                    onClick={() => void send()}
                  >
                    {busy === 'send' ? (
                      <Loader2 className="animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Send aria-hidden />
                    )}
                    {t('emailBroadcastSend')}
                  </Button>
                </div>
              </section>
            </div>
          ) : null}

          {!isDraft ? (
            <section className="space-y-4">
              {broadcast.counts ? <BroadcastCountsGrid counts={broadcast.counts} /> : null}
              <dl className="grid max-w-3xl gap-x-6 gap-y-2 rounded-xl border border-border bg-card p-4 text-sm shadow-xs sm:grid-cols-[10rem_1fr]">
                <dt className="text-muted-foreground">{t('emailBroadcastSender')}</dt>
                <dd className="font-mono">{broadcast.fromEmail}</dd>
                <dt className="text-muted-foreground">{t('emailBroadcastDelivery')}</dt>
                <dd>{t(`emailBroadcastDelivery_${broadcast.delivery}`)}</dd>
                {broadcast.templateVersion ? (
                  <>
                    <dt className="text-muted-foreground">{t('emailBroadcastVersion')}</dt>
                    <dd className="font-mono">v{broadcast.templateVersion}</dd>
                  </>
                ) : null}
              </dl>
              {broadcast.lastErrorCode ? (
                <Alert variant="destructive">
                  <AlertDescription className="font-mono text-sm">
                    {emailErrorText(t, new EmailApiError(broadcast.lastErrorCode, 409))}
                  </AlertDescription>
                </Alert>
              ) : null}
              {active ? (
                <p
                  className="text-xs text-muted-foreground"
                  role="status"
                >
                  {t('emailBroadcastSendingHint')}
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
