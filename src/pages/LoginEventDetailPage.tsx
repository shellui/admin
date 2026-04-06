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
import {
  fetchAdminLoginEvent,
  fetchAdminLoginEvents,
  type AdminLoginEventListResponse,
  type AdminLoginEventRow,
} from '@/lib/adminUsersApi';
import { cn } from '@/lib/utils';

const SIBLING_PAGE_SIZE = 10;

function detailField(label: string, value: string | null | undefined) {
  const v = value != null && String(value).trim() !== '' ? String(value) : '—';
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words font-mono text-sm">{v}</dd>
    </div>
  );
}

export function LoginEventDetailPage() {
  const { t, i18n } = useTranslation();
  const { eventId } = useParams<{ eventId: string }>();
  const accessToken = useShelluiAccessToken();

  const idNum = useMemo(() => {
    const n = parseInt(eventId || '', 10);
    return Number.isFinite(n) ? n : NaN;
  }, [eventId]);

  const [event, setEvent] = useState<AdminLoginEventRow | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  const [siblings, setSiblings] = useState<AdminLoginEventListResponse | null>(null);
  const [siblingPage, setSiblingPage] = useState(1);
  const [loadingSiblings, setLoadingSiblings] = useState(false);
  const [siblingsError, setSiblingsError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    if (!accessToken || !Number.isFinite(idNum)) {
      setLoadingEvent(false);
      setEvent(null);
      setEventError(null);
      return;
    }
    setLoadingEvent(true);
    setEventError(null);
    try {
      const row = await fetchAdminLoginEvent(accessToken, idNum);
      setEvent(row);
    } catch (e) {
      setEvent(null);
      setEventError(e instanceof Error ? e.message : t('loginEventsErrorUnknown'));
    } finally {
      setLoadingEvent(false);
    }
  }, [accessToken, idNum, t]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    setSiblingPage(1);
  }, [event?.user_id, event?.id]);

  const loadSiblings = useCallback(async () => {
    if (!accessToken || !event?.user_id) {
      setSiblings(null);
      setSiblingsError(null);
      return;
    }
    setLoadingSiblings(true);
    setSiblingsError(null);
    try {
      const res = await fetchAdminLoginEvents(accessToken, {
        user_id: event.user_id,
        page: siblingPage,
        pageSize: SIBLING_PAGE_SIZE,
      });
      setSiblings(res);
    } catch (e) {
      setSiblings(null);
      setSiblingsError(e instanceof Error ? e.message : t('loginEventsErrorUnknown'));
    } finally {
      setLoadingSiblings(false);
    }
  }, [accessToken, event?.user_id, siblingPage, t]);

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

  const siblingTotalPages = useMemo(() => {
    if (!siblings?.count) return 1;
    return Math.max(1, Math.ceil(siblings.count / SIBLING_PAGE_SIZE));
  }, [siblings?.count]);

  if (!Number.isFinite(idNum)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{t('loginEventsInvalidId')}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/login-events">
            <ArrowLeft className="mr-2 size-4" aria-hidden />
            {t('loginEventsBackToList')}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2" asChild>
          <Link to="/login-events">
            <ArrowLeft className="mr-1 size-4" aria-hidden />
            {t('loginEventsBackToList')}
          </Link>
        </Button>
      </div>

      {!accessToken ? (
        <p className="text-sm text-muted-foreground">{t('loginEventsNoSession')}</p>
      ) : null}

      {accessToken && loadingEvent && !event ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-sm">{t('loginEventsDetailLoading')}</span>
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
                {t('loginEventsDetailTitle', { id: event.id })}
              </h1>
              <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                {t('loginEventsBadge')}
              </Badge>
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-medium',
                  event.outcome === 'success'
                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                    : 'bg-destructive/15 text-destructive',
                )}
              >
                {event.outcome}
              </span>
            </div>
            <Text className="text-sm text-muted-foreground">{formatDateTime(event.created_at)}</Text>
            {event.user_id != null ? (
              <Button variant="link" className="h-auto p-0 text-sm" asChild>
                <Link to={`/users/${event.user_id}`}>{t('loginEventsOpenUserProfile')}</Link>
              </Button>
            ) : null}
          </header>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-lg">{t('loginEventsDetailPayloadTitle')}</CardTitle>
              <CardDescription className="text-sm">{t('loginEventsDetailPayloadHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {detailField(t('loginEventsDetailId'), String(event.id))}
                {detailField(t('userDetailLoginColProvider'), event.provider)}
                {detailField(t('userDetailLoginColOutcome'), event.outcome)}
                {detailField(t('loginEventsDetailFailureReason'), event.failure_reason || null)}
                {detailField(t('userDetailLoginColStaff'), event.is_staff_at_event ? t('usersStaffYes') : t('usersStaffNo'))}
                {detailField(t('loginEventsDetailUserEmail'), event.user_email)}
                {detailField(t('loginEventsDetailUserId'), event.user_id != null ? String(event.user_id) : null)}
                {detailField(t('loginEventsDetailIpHash'), event.ip_hash)}
                {detailField(t('userDetailLoginColUserAgent'), event.user_agent)}
                {detailField(t('userDetailLoginColTimezone'), event.client_timezone)}
                {detailField(t('loginEventsDetailDeviceHash'), event.client_device_id_hash)}
                {detailField(t('userDetailLoginColCountry'), event.client_country)}
                {detailField(t('loginEventsDetailCity'), event.client_city)}
              </dl>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="font-heading text-lg font-semibold">{t('loginEventsSiblingTitle')}</h2>
              <Text className="text-sm text-muted-foreground">{t('loginEventsSiblingHint')}</Text>
            </div>
            <Separator />

            {event.user_id == null ? (
              <p className="text-sm text-muted-foreground">{t('loginEventsSiblingNoUser')}</p>
            ) : siblingsError ? (
              <p className="text-sm text-destructive">{siblingsError}</p>
            ) : loadingSiblings && !siblings ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                <span className="text-sm">{t('loginEventsSiblingLoading')}</span>
              </div>
            ) : siblingRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('loginEventsSiblingEmpty')}</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {siblingRows.map((ev) => (
                    <li key={ev.id}>
                      <Link
                        to={`/login-events/${ev.id}`}
                        className={cn(
                          'block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] text-muted-foreground">#{ev.id}</span>
                              <span className="text-sm font-medium">{ev.provider}</span>
                              <span
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-[11px]',
                                  ev.outcome === 'success'
                                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                                    : 'bg-destructive/15 text-destructive',
                                )}
                              >
                                {ev.outcome}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{formatDateTime(ev.created_at)}</p>
                          </div>
                          <span className="shrink-0 text-xs text-primary">{t('loginEventsOpenDetail')}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                {siblingTotalPages > 1 ? (
                  <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {t('userDetailLoginPagination', {
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
