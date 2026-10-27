import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { SkeletonRows } from '@/components/admin/DataTableCard';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { useEventLogSource } from '@/hooks/useEventRetention';
import {
  eventDetailPath,
  eventsListPath,
  eventSummary,
  fetchEventLog,
  fetchEventLogEntry,
  isFailureEvent,
  type EventLogListResponse,
  type EventLogRow,
} from '@/lib/eventLogApi';
import type { WebhookServiceKey } from '@/lib/webhookServices';

const SIBLING_PAGE_SIZE = 10;

function formatValue(value: unknown): string {
  if (value == null || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function detailField(label: string, value: unknown, key?: string) {
  return (
    <div
      key={key}
      className="grid min-w-0 gap-1 px-4 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4"
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words font-mono text-sm">{formatValue(value)}</dd>
    </div>
  );
}

export function EventDetailPage({ service = 'identity' }: { service?: WebhookServiceKey }) {
  const { t, i18n } = useTranslation();
  const { eventId } = useParams<{ eventId: string }>();
  const accessToken = useShelluiAccessToken();
  const source = useEventLogSource(service);

  const idNum = useMemo(() => {
    const n = parseInt(eventId || '', 10);
    return Number.isFinite(n) ? n : NaN;
  }, [eventId]);

  const [event, setEvent] = useState<EventLogRow | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  const [siblings, setSiblings] = useState<EventLogListResponse | null>(null);
  const [siblingPage, setSiblingPage] = useState(1);
  const [loadingSiblings, setLoadingSiblings] = useState(false);
  const [siblingsError, setSiblingsError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    if (!accessToken || !source || !Number.isFinite(idNum)) {
      setLoadingEvent(false);
      setEvent(null);
      setEventError(null);
      return;
    }
    setLoadingEvent(true);
    setEventError(null);
    try {
      setEvent(await fetchEventLogEntry(source, accessToken, idNum));
    } catch (e) {
      setEvent(null);
      setEventError(e instanceof Error ? e.message : t('eventsErrorUnknown'));
    } finally {
      setLoadingEvent(false);
    }
  }, [accessToken, source, idNum, t]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    setSiblingPage(1);
  }, [event?.user_id, event?.id]);

  const loadSiblings = useCallback(async () => {
    if (!accessToken || !source || event?.user_id == null) {
      setSiblings(null);
      setSiblingsError(null);
      return;
    }
    setLoadingSiblings(true);
    setSiblingsError(null);
    try {
      setSiblings(
        await fetchEventLog(source, accessToken, {
          userId: event.user_id,
          page: siblingPage,
          pageSize: SIBLING_PAGE_SIZE,
        }),
      );
    } catch (e) {
      setSiblings(null);
      setSiblingsError(e instanceof Error ? e.message : t('eventsErrorUnknown'));
    } finally {
      setLoadingSiblings(false);
    }
  }, [accessToken, source, event?.user_id, siblingPage, t]);

  useEffect(() => {
    void loadSiblings();
  }, [loadSiblings]);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(i18n.language || 'en', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(d);
  };

  const siblingRows = useMemo(() => {
    if (!siblings || !event) return [];
    return siblings.results.filter((r) => r.id !== event.id);
  }, [siblings, event]);

  const siblingTotalPages = siblings?.count
    ? Math.max(1, Math.ceil(siblings.count / SIBLING_PAGE_SIZE))
    : 1;

  const back = { to: eventsListPath(service), label: t('eventsBackToList') };
  const card =
    'overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm';

  if (!Number.isFinite(idNum)) {
    return (
      <div className="w-full space-y-6">
        <PageHeader
          back={back}
          title={t('eventsDetailPayloadTitle')}
        />
        <Alert variant="destructive">
          <AlertDescription>{t('eventsInvalidId')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {!event ? (
        <PageHeader
          back={back}
          title={
            loadingEvent && accessToken ? (
              <Skeleton className="h-8 w-64" />
            ) : (
              t('eventsDetailPayloadTitle')
            )
          }
        />
      ) : (
        <PageHeader
          back={back}
          title={<span className="break-all font-mono text-xl">{event.event_type}</span>}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <span>{event.label}</span>
              {isFailureEvent(event) ? (
                <StatusBadge tone="destructive">{t('eventsFailureBadge')}</StatusBadge>
              ) : null}
              <span aria-hidden>·</span>
              <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
            </span>
          }
          actions={
            event.user_id != null ? (
              <Button
                variant="outline"
                asChild
              >
                <Link to={`/users/${event.user_id}`}>
                  <UserRound aria-hidden />
                  {t('eventsOpenUserProfile')}
                </Link>
              </Button>
            ) : null
          }
        />
      )}

      {!accessToken ? (
        <Alert>
          <AlertDescription>{t('eventsNoSession')}</AlertDescription>
        </Alert>
      ) : null}

      {accessToken && loadingEvent && !event ? (
        <div
          className={`${card} space-y-3 p-4`}
          aria-busy="true"
          aria-label={t('eventsDetailLoading')}
        >
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      ) : null}

      {eventError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{eventError}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadEvent()}
            >
              {t('usersRetry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {event ? (
        <>
          <dl className={`${card} divide-y divide-border`}>
            {detailField(t('eventsDetailId'), event.id)}
            {detailField(t('eventsDetailUserEmail'), event.user_email)}
            {detailField(t('eventsDetailUserId'), event.user_id)}
          </dl>

          <section className={card}>
            <div className="space-y-1 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{t('eventsDetailPayloadTitle')}</h2>
              <p className="text-xs text-muted-foreground">
                {t(
                  service === 'identity'
                    ? 'eventsDetailPayloadHint'
                    : 'eventsDetailPayloadHintService',
                )}
              </p>
            </div>
            {Object.keys(event.data).length ? (
              <dl className="divide-y divide-border">
                {Object.entries(event.data).map(([key, value]) => detailField(key, value, key))}
              </dl>
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">-</p>
            )}
          </section>

          <section className={card}>
            <div className="space-y-1 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{t('eventsSiblingTitle')}</h2>
              <p className="text-xs text-muted-foreground">{t('eventsSiblingHint')}</p>
            </div>

            {event.user_id == null ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{t('eventsSiblingNoUser')}</p>
            ) : siblingsError ? (
              <div className="p-4">
                <Alert variant="destructive">
                  <AlertDescription>{siblingsError}</AlertDescription>
                </Alert>
              </div>
            ) : loadingSiblings && !siblings ? (
              <SkeletonRows
                rows={4}
                columns={['w-40', 'w-56', 'w-24']}
              />
            ) : siblingRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{t('eventsSiblingEmpty')}</p>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {siblingRows.map((ev) => {
                    const summary = eventSummary(ev);
                    return (
                      <li key={ev.id}>
                        <Link
                          to={eventDetailPath(service, ev.id)}
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
                        >
                          <span className="min-w-0 space-y-0.5">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs">{ev.label}</span>
                              {isFailureEvent(ev) ? (
                                <StatusBadge tone="destructive">
                                  {t('eventsFailureBadge')}
                                </StatusBadge>
                              ) : null}
                              {summary ? (
                                <span className="truncate text-xs text-muted-foreground">
                                  {summary}
                                </span>
                              ) : null}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {formatDateTime(ev.created_at)}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-medium text-primary-ink">
                            {t('eventsOpenDetail')}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {siblingTotalPages > 1 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5">
                    <p className="text-xs text-muted-foreground">
                      {t('eventsPageStatus', {
                        page: siblingPage,
                        pages: siblingTotalPages,
                        total: siblings?.count ?? 0,
                      })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={siblingPage <= 1 || loadingSiblings}
                        onClick={() => setSiblingPage((p) => Math.max(1, p - 1))}
                      >
                        {t('usersPrevPage')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={siblingPage >= siblingTotalPages || loadingSiblings}
                        onClick={() => setSiblingPage((p) => p + 1)}
                      >
                        {t('usersNextPage')}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
