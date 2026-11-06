import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, createSearchParams, useSearchParams } from 'react-router-dom';
import { Activity, ChevronDown, Clock, ScrollText, X } from 'lucide-react';
import { DataTableCard, SkeletonRows } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { KpiCard } from '@/components/admin/Kpi';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EventRetentionAlert } from '@/components/EventRetentionAlert';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { useEventLogSource, useEventRetention } from '@/hooks/useEventRetention';
import {
  eventDetailPath,
  eventSummary,
  fetchEventLog,
  fetchEventTypes,
  isFailureEvent,
  type EventLogListResponse,
  type EventTypeRow,
} from '@/lib/eventLogApi';
import type { WebhookServiceKey } from '@/lib/webhookServices';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const PAGE_COPY = {
  identity: {
    title: 'eventsTitle',
    badge: 'eventsBadge',
    description: 'eventsDescription',
    retentionHint: 'eventsStatRetentionHint',
  },
  storage: {
    title: 'eventsTitleStorage',
    badge: 'eventsBadgeStorage',
    description: 'eventsDescriptionStorage',
    retentionHint: 'eventsStatRetentionHintService',
  },
  hosting: {
    title: 'eventsTitleHosting',
    badge: 'eventsBadgeHosting',
    description: 'eventsDescriptionHosting',
    retentionHint: 'eventsStatRetentionHintService',
  },
  email: {
    title: 'eventsTitleEmail',
    badge: 'eventsBadgeEmail',
    description: 'eventsDescriptionEmail',
    retentionHint: 'eventsStatRetentionHintService',
  },
} as const satisfies Record<WebhookServiceKey, Record<string, string>>;

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
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
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

export function EventsListPage({ service = 'identity' }: { service?: WebhookServiceKey }) {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useShelluiAccessToken();
  const source = useEventLogSource(service);
  const retention = useEventRetention(source, accessToken);
  const isLg = useIsLgViewport();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarOpen = isLg || mobileSidebarOpen;
  const copy = PAGE_COPY[service];

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
    if (!accessToken || !source) return;
    let cancelled = false;
    void fetchEventTypes(source, accessToken)
      .then((rows) => {
        if (!cancelled) setEventTypes([...rows].sort((a, b) => a.label.localeCompare(b.label)));
      })
      .catch(() => undefined);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    void fetchEventLog(source, accessToken, { createdAfter: since, pageSize: 1 })
      .then((res) => {
        if (!cancelled) setCount24h(res.count);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accessToken, source]);

  const load = useCallback(async () => {
    if (!accessToken || !source) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(
        await fetchEventLog(source, accessToken, {
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
  }, [accessToken, source, filters, pageParam, t]);

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

  const fieldLabel = 'text-xs font-medium text-muted-foreground';

  const filterCard = (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      {!accessToken ? (
        <p className="text-sm text-muted-foreground">{t('eventsNoSession')}</p>
      ) : (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            aria-label={t('eventsFiltersTitle')}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] lg:items-end"
          >
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={fieldLabel}>{t('eventsFieldType')}</FormLabel>
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
                  <FormLabel className={fieldLabel}>{t('eventsFieldUser')}</FormLabel>
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
            <FormField
              control={form.control}
              name="from"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={fieldLabel}>{t('eventsFieldFrom')}</FormLabel>
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
                  <FormLabel className={fieldLabel}>{t('eventsFieldTo')}</FormLabel>
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
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1">
              <Button
                type="submit"
                disabled={loading}
              >
                {t('eventsApplyFilters')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={loading || !hasActiveFilters}
                onClick={clearFilters}
              >
                {t('eventsClearFilters')}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t(copy.title)}
        service={t(copy.badge)}
        description={t(copy.description)}
      />

      {!source ? (
        <Alert variant="destructive">
          <AlertDescription>{t('eventsServiceNotConfigured')}</AlertDescription>
        </Alert>
      ) : null}

      <EventRetentionAlert
        service={service}
        status={retention}
      />

      <details
        className="group rounded-xl border border-border bg-card shadow-xs lg:border-0 lg:bg-transparent lg:shadow-none"
        open={sidebarOpen}
        onToggle={(e) => {
          if (isLg) return;
          setMobileSidebarOpen(e.currentTarget.open);
        }}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left marker:content-none lg:hidden [&::-webkit-details-marker]:hidden">
          <span className="font-heading text-sm font-semibold tracking-tight">
            {t('eventsSidebarSummary')}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </summary>
        <div className="space-y-4 border-t border-border px-4 pb-4 pt-4 lg:border-t-0 lg:p-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              label={t('eventsStat24hTitle')}
              value={count24h == null ? '-' : String(count24h)}
              icon={Activity}
            />
            <KpiCard
              label={t('eventsStatRetentionTitle')}
              value={
                retention == null
                  ? '-'
                  : t('eventsStatRetentionValue', { count: retention.data_retention_days })
              }
              hint={t(copy.retentionHint)}
              icon={Clock}
            />
          </div>
          {filterCard}
        </div>
      </details>

      {filters.userId != null ? (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="info">
            {t('eventsFilterUserId', { id: filters.userId })}
            <button
              type="button"
              onClick={clearUserId}
              className="-mr-1 rounded-sm p-0.5 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('eventsClearUserFilter')}
            >
              <X
                className="size-3"
                aria-hidden
              />
            </button>
          </StatusBadge>
        </div>
      ) : null}

      {error && !loading ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void load()}
            >
              {t('usersRetry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {accessToken && source && !error ? (
        <DataTableCard
          label={t('eventsListAria')}
          busy={loading}
          toolbar={
            data ? (
              <p className="text-xs text-muted-foreground">
                {t('eventsListingSummary', { total: data.count ?? 0 })}
              </p>
            ) : undefined
          }
          footer={
            totalPages > 1 ? (
              <>
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
              </>
            ) : undefined
          }
        >
          {loading && !data ? (
            <SkeletonRows
              rows={6}
              columns={['w-28', 'w-40', 'w-36', 'w-48']}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={t('eventsEmpty')}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="whitespace-nowrap">{t('eventsColWhen')}</TableHead>
                  <TableHead>{t('eventsColEvent')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('eventsColUser')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('eventsColDetails')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((ev) => {
                  const href = eventDetailPath(service, ev.id);
                  const summary = eventSummary(ev);
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        <Link
                          to={href}
                          className="font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          {formatShortDateTime(ev.created_at)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs">{ev.label}</span>
                          {isFailureEvent(ev) ? (
                            <StatusBadge tone="destructive">{t('eventsFailureBadge')}</StatusBadge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell
                        className="hidden max-w-[16rem] truncate text-xs sm:table-cell"
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
                          ev.user_email || <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="hidden max-w-[20rem] truncate text-xs text-muted-foreground md:table-cell"
                        title={summary || undefined}
                      >
                        {summary || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTableCard>
      ) : null}
    </div>
  );
}
