import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Separator } from '@/components/ui/separator';
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
import { cn } from '@/lib/utils';

const SIBLING_PAGE_SIZE = 10;

function formatValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function detailField(label: string, value: unknown, key?: string) {
  return (
    <div
      key={key}
      className="min-w-0 space-y-0.5"
    >
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
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

  const backLink = (
    <Link to={eventsListPath(service)}>
      <ArrowLeft
        className="mr-1 size-4"
        aria-hidden
      />
      {t('eventsBackToList')}
    </Link>
  );

  if (!Number.isFinite(idNum)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{t('eventsInvalidId')}</p>
        <Button
          variant="outline"
          size="sm"
          asChild
        >
          {backLink}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 px-2"
          asChild
        >
          {backLink}
        </Button>
      </div>

      {!accessToken ? (
        <p className="text-sm text-muted-foreground">{t('eventsNoSession')}</p>
      ) : null}

      {accessToken && loadingEvent && !event ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2
            className="size-5 animate-spin"
            aria-hidden
          />
          <span className="text-sm">{t('eventsDetailLoading')}</span>
        </div>
      ) : null}

      {eventError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {eventError}
        </p>
      ) : null}

      {event ? (
        <>
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
                {event.label}
              </h1>
              <Badge
                variant="secondary"
                className="font-mono text-[10px]"
              >
                {event.event_type}
              </Badge>
              {isFailureEvent(event) ? (
                <span className="rounded bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                  {t('eventsFailureBadge')}
                </span>
              ) : null}
            </div>
            <Text className="text-sm text-muted-foreground">
              {formatDateTime(event.created_at)}
            </Text>
            {event.user_id != null ? (
              <Button
                variant="link"
                className="h-auto p-0 text-sm"
                asChild
              >
                <Link to={`/users/${event.user_id}`}>{t('eventsOpenUserProfile')}</Link>
              </Button>
            ) : null}
          </header>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-lg">
                {t('eventsDetailPayloadTitle')}
              </CardTitle>
              <CardDescription className="text-sm">
                {t(
                  service === 'identity'
                    ? 'eventsDetailPayloadHint'
                    : 'eventsDetailPayloadHintService',
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {detailField(t('eventsDetailId'), event.id)}
                {detailField(t('eventsDetailUserEmail'), event.user_email)}
                {detailField(t('eventsDetailUserId'), event.user_id)}
                {Object.entries(event.data).map(([key, value]) => detailField(key, value, key))}
              </dl>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="font-heading text-lg font-semibold">{t('eventsSiblingTitle')}</h2>
              <Text className="text-sm text-muted-foreground">{t('eventsSiblingHint')}</Text>
            </div>
            <Separator />

            {event.user_id == null ? (
              <p className="text-sm text-muted-foreground">{t('eventsSiblingNoUser')}</p>
            ) : siblingsError ? (
              <p className="text-sm text-destructive">{siblingsError}</p>
            ) : loadingSiblings && !siblings ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2
                  className="size-4 animate-spin"
                  aria-hidden
                />
                <span className="text-sm">{t('eventsLoading')}</span>
              </div>
            ) : siblingRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('eventsSiblingEmpty')}</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {siblingRows.map((ev) => {
                    const summary = eventSummary(ev);
                    return (
                      <li key={ev.id}>
                        <Link
                          to={eventDetailPath(service, ev.id)}
                          className={cn(
                            'block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    'rounded px-1.5 py-0.5 text-[11px] font-medium',
                                    isFailureEvent(ev)
                                      ? 'bg-destructive/15 text-destructive'
                                      : 'bg-muted text-foreground',
                                  )}
                                >
                                  {ev.label}
                                </span>
                                {summary ? (
                                  <span className="truncate text-xs text-muted-foreground">
                                    {summary}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(ev.created_at)}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs text-primary">
                              {t('eventsOpenDetail')}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {siblingTotalPages > 1 ? (
                  <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
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
