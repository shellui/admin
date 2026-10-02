import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, createSearchParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { EventRetentionAlert } from '@/components/EventRetentionAlert';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { useEventRetention } from '@/hooks/useEventRetention';
import {
  eventSummary,
  fetchEventLog,
  fetchEventTypes,
  isFailureEvent,
  type EventLogListResponse,
  type EventTypeRow,
} from '@/lib/eventLogApi';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type FilterValues = {
  type: string;
  user: string;
  from: string;
  to: string;
};

type UrlFilters = FilterValues & { userId: number | null };

function readFilters(sp: URLSearchParams): UrlFilters {
  const date = (key: string) => {
    const v = sp.get(key) ?? '';
    return DATE_RE.test(v) ? v : '';
  };
  const uid = parseInt(sp.get('user_id') || '', 10);
  return {
    type: sp.get('type') ?? '',
    user: sp.get('user') ?? '',
    from: date('from'),
    to: date('to'),
    userId: Number.isFinite(uid) ? uid : null,
  };
}

function filtersToSearch(f: UrlFilters, page: number) {
  const next: Record<string, string> = { page: String(page) };
  if (f.type) next.type = f.type;
  if (f.user.trim()) next.user = f.user.trim();
  if (f.from) next.from = f.from;
  if (f.to) next.to = f.to;
  if (f.userId != null) next.user_id = String(f.userId);
  return createSearchParams(next);
}

/** Local-day bounds: `from` inclusive, `to` inclusive (sent as the next day's start, exclusive). */
function dayStartIso(day: string, addDays = 0): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + addDays);
  return d.toISOString();
}

function selectFieldClassName() {
  return cn(
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
  );
}

const LG_PX = 1024;

function subscribeMinWidth1024(onChange: () => void) {
  const mq = window.matchMedia(`(min-width: ${LG_PX}px)`);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getMinWidth1024Snapshot() {
  return window.matchMedia(`(min-width: ${LG_PX}px)`).matches;
}

function useIsLgViewport() {
  return useSyncExternalStore(subscribeMinWidth1024, getMinWidth1024Snapshot, () => false);
}

export function EventsListPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useShelluiAccessToken();
  const retention = useEventRetention(accessToken);
  const isLg = useIsLgViewport();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarOpen = isLg || mobileSidebarOpen;

  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  const form = useForm<FilterValues>({ defaultValues: filters });
  const { reset } = form;
  useEffect(() => {
    reset(filters);
  }, [filters, reset]);

  const [eventTypes, setEventTypes] = useState<EventTypeRow[]>([]);
  const [data, setData] = useState<EventLogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count24h, setCount24h] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void fetchEventTypes(accessToken)
      .then((rows) => {
        if (!cancelled) setEventTypes([...rows].sort((a, b) => a.label.localeCompare(b.label)));
      })
      .catch(() => undefined);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    void fetchEventLog(accessToken, { createdAfter: since, pageSize: 1 })
      .then((res) => {
        if (!cancelled) setCount24h(res.count);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(
        await fetchEventLog(accessToken, {
          page: pageParam,
          pageSize: PAGE_SIZE,
          eventTypes: filters.type ? [filters.type] : undefined,
          userId: filters.userId ?? undefined,
          user: filters.user,
          createdAfter: filters.from ? dayStartIso(filters.from) : undefined,
          createdBefore: filters.to ? dayStartIso(filters.to, 1) : undefined,
        }),
      );
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : t('eventsErrorUnknown'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters, pageParam, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSubmit(values: FilterValues) {
    setSearchParams(filtersToSearch({ ...values, userId: filters.userId }, 1));
  }

  function clearFilters() {
    setSearchParams(createSearchParams({ page: '1' }));
  }

  function clearUserId() {
    setSearchParams(filtersToSearch({ ...filters, userId: null }, 1));
  }

  function goToPage(nextPage: number) {
    setSearchParams(filtersToSearch(filters, nextPage));
  }

  const totalPages = data?.count ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  const formatShortDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(i18n.language || 'en', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  };

  const rows = data?.results ?? [];
  const hasActiveFilters = Boolean(
    filters.type || filters.user.trim() || filters.from || filters.to || filters.userId != null,
  );
  const labelClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';
  const headClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('eventsTitle')}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            {t('eventsBadge')}
          </Badge>
        </div>
        <Text className="max-w-3xl text-sm text-muted-foreground">{t('eventsDescription')}</Text>
      </header>

      <EventRetentionAlert status={retention} />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(17rem,20rem)] lg:items-start">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start">
          <details
            className="group rounded-xl border border-border/80 bg-card shadow-sm lg:border-0 lg:bg-transparent lg:shadow-none"
            open={sidebarOpen}
            onToggle={(e) => {
              if (isLg) return;
              setMobileSidebarOpen(e.currentTarget.open);
            }}
          >
            <summary
              className={cn(
                'flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left',
                'marker:content-none [&::-webkit-details-marker]:hidden lg:hidden',
              )}
            >
              <span className="font-heading text-sm font-semibold tracking-tight">
                {t('eventsSidebarSummary')}
              </span>
              <ChevronDown
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="space-y-4 border-t border-border/60 px-4 pb-4 pt-4 lg:border-t-0 lg:px-0 lg:pb-0 lg:pt-0">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-base">
                      {t('eventsStat24hTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {count24h == null ? (
                      <Skeleton className="h-9 w-20" />
                    ) : (
                      <p className="font-mono text-3xl font-semibold tabular-nums">{count24h}</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-base">
                      {t('eventsStatRetentionTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {retention == null ? (
                      <Skeleton className="h-9 w-20" />
                    ) : (
                      <p className="font-mono text-3xl font-semibold tabular-nums">
                        {t('eventsStatRetentionValue', { count: retention.data_retention_days })}
                      </p>
                    )}
                    <CardDescription className="text-xs">
                      {t('eventsStatRetentionHint')}
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/80 shadow-sm">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="font-heading text-lg">{t('eventsFiltersTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {!accessToken ? (
                    <p className="text-sm text-muted-foreground">{t('eventsNoSession')}</p>
                  ) : (
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-5"
                      >
                        <div className="grid grid-cols-1 gap-4">
                          <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={labelClass}>{t('eventsFieldType')}</FormLabel>
                                <FormControl>
                                  <select
                                    {...field}
                                    className={selectFieldClassName()}
                                  >
                                    <option value="">{t('eventsFilterAny')}</option>
                                    {eventTypes.map((et) => (
                                      <option
                                        key={et.type}
                                        value={et.type}
                                      >
                                        {et.label}
                                      </option>
                                    ))}
                                  </select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="user"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={labelClass}>{t('eventsFieldUser')}</FormLabel>
                                <FormControl>
                                  <Input
                                    className="text-sm"
                                    placeholder={t('eventsFieldUserPlaceholder')}
                                    autoComplete="off"
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={form.control}
                              name="from"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className={labelClass}>
                                    {t('eventsFieldFrom')}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      className="text-sm"
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="to"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className={labelClass}>{t('eventsFieldTo')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      className="text-sm"
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            disabled={loading}
                            className="w-full sm:w-auto"
                          >
                            {t('eventsApplyFilters')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loading || !hasActiveFilters}
                            className="w-full sm:w-auto"
                            onClick={clearFilters}
                          >
                            {t('eventsClearFilters')}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </div>
          </details>
        </aside>

        <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
          {filters.userId != null ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="gap-1 text-[11px]"
              >
                {t('eventsFilterUserId', { id: filters.userId })}
                <button
                  type="button"
                  onClick={clearUserId}
                  className="rounded-sm hover:text-foreground"
                  aria-label={t('eventsClearUserFilter')}
                >
                  <X
                    className="size-3"
                    aria-hidden
                  />
                </button>
              </Badge>
            </div>
          ) : null}

          <section aria-label={t('eventsListAria')}>
            {accessToken && loading && !data ? (
              <div className="flex items-center gap-2 py-12 text-muted-foreground">
                <Loader2
                  className="size-5 animate-spin"
                  aria-hidden
                />
                <span className="text-sm">{t('eventsLoading')}</span>
              </div>
            ) : null}
            {error && !loading ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {data && rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('eventsEmpty')}</p>
            ) : null}
            {rows.length > 0 ? (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t('eventsListingSummary', { total: data?.count ?? 0 })}
                </p>
                <div className="rounded-md border border-border">
                  <div className="w-full overflow-x-auto">
                    <Table className="min-w-[34rem] md:min-w-[48rem]">
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className={cn('whitespace-nowrap', headClass)}>
                            {t('eventsColWhen')}
                          </TableHead>
                          <TableHead className={headClass}>{t('eventsColEvent')}</TableHead>
                          <TableHead className={headClass}>{t('eventsColUser')}</TableHead>
                          <TableHead className={cn('hidden md:table-cell', headClass)}>
                            {t('eventsColDetails')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {rows.map((ev) => {
                          const href = `/events/${ev.id}`;
                          const summary = eventSummary(ev);
                          return (
                            <TableRow
                              key={ev.id}
                              className="hover:bg-muted/40"
                            >
                              <TableCell className="whitespace-nowrap font-mono text-muted-foreground">
                                <Link
                                  to={href}
                                  className="text-primary underline-offset-2 hover:underline"
                                >
                                  {formatShortDateTime(ev.created_at)}
                                </Link>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={cn(
                                    'rounded px-1.5 py-0.5 font-medium',
                                    isFailureEvent(ev)
                                      ? 'bg-destructive/15 text-destructive'
                                      : 'bg-muted text-foreground',
                                  )}
                                >
                                  {ev.label}
                                </span>
                              </TableCell>
                              <TableCell
                                className="max-w-[12rem] truncate font-mono lg:max-w-[16rem]"
                                title={ev.user_email ?? undefined}
                              >
                                {ev.user_id != null ? (
                                  <Link
                                    to={`/users/${ev.user_id}`}
                                    className="underline-offset-2 hover:underline"
                                  >
                                    {ev.user_email || `#${ev.user_id}`}
                                  </Link>
                                ) : (
                                  ev.user_email || '—'
                                )}
                              </TableCell>
                              <TableCell
                                className="hidden max-w-[18rem] truncate text-muted-foreground md:table-cell"
                                title={summary || undefined}
                              >
                                {summary || '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {totalPages > 1 ? (
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {t('eventsPageStatus', {
                        page: pageParam,
                        pages: totalPages,
                        total: data?.count ?? 0,
                      })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pageParam <= 1 || loading}
                        onClick={() => goToPage(Math.max(1, pageParam - 1))}
                      >
                        {t('usersPrevPage')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pageParam >= totalPages || loading}
                        onClick={() => goToPage(pageParam + 1)}
                      >
                        {t('usersNextPage')}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
