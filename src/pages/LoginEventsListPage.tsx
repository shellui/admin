import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, createSearchParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { fetchAdminLoginEvents, type AdminLoginEventListResponse } from '@/lib/adminUsersApi';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

const filterSchema = z.object({
  outcome: z.enum(['', 'success', 'failure']),
  provider: z.string(),
  country: z.string(),
  city: z.string(),
  tz: z.string(),
  language: z.enum(['', 'en', 'fr']),
  staff: z.enum(['', 'true', 'false']),
});

type FilterValues = z.infer<typeof filterSchema>;

function readFiltersFromSearch(sp: URLSearchParams): FilterValues {
  const o = (sp.get('outcome') || '').toLowerCase();
  const outcome = o === 'success' || o === 'failure' ? o : '';
  const lang = (sp.get('language') || '').toLowerCase();
  const language = lang === 'en' || lang === 'fr' ? lang : '';
  const st = (sp.get('staff') || '').toLowerCase();
  const staff = st === 'true' || st === 'false' ? st : '';
  return {
    outcome: outcome as FilterValues['outcome'],
    provider: sp.get('provider') ?? '',
    country: sp.get('country') ?? '',
    city: sp.get('city') ?? '',
    tz: sp.get('tz') ?? '',
    language: language as FilterValues['language'],
    staff: staff as FilterValues['staff'],
  };
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

export function LoginEventsListPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useShelluiAccessToken();
  const isLg = useIsLgViewport();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarOpen = isLg || mobileSidebarOpen;

  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const filtersFromUrl = useMemo(() => readFiltersFromSearch(searchParams), [searchParams]);

  const form = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: filtersFromUrl,
  });

  const { reset } = form;
  useEffect(() => {
    reset(filtersFromUrl);
  }, [filtersFromUrl, reset]);

  const [data, setData] = useState<AdminLoginEventListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [count24h, setCount24h] = useState<number | null>(null);
  const [loading24h, setLoading24h] = useState(false);
  const [error24h, setError24h] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setCount24h(null);
      setError24h(null);
      return;
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let cancelled = false;
    setLoading24h(true);
    setError24h(null);
    void fetchAdminLoginEvents(accessToken, { created_after: since, page: 1, pageSize: 1 })
      .then((res) => {
        if (!cancelled) setCount24h(res.count);
      })
      .catch((e) => {
        if (!cancelled) {
          setCount24h(null);
          setError24h(e instanceof Error ? e.message : t('loginEventsErrorUnknown'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading24h(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, t]);

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
      const f = filtersFromUrl;
      const is_staff_at_event =
        f.staff === 'true' ? true : f.staff === 'false' ? false : undefined;
      const res = await fetchAdminLoginEvents(accessToken, {
        page: pageParam,
        pageSize: PAGE_SIZE,
        outcome: f.outcome || undefined,
        provider: f.provider || undefined,
        client_country: f.country || undefined,
        client_city: f.city || undefined,
        client_timezone: f.tz || undefined,
        language: f.language || undefined,
        is_staff_at_event,
      });
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : t('loginEventsErrorUnknown'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, filtersFromUrl, pageParam, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSubmit(values: FilterValues) {
    const next: Record<string, string> = { page: '1' };
    if (values.outcome) next.outcome = values.outcome;
    if (values.provider.trim()) next.provider = values.provider.trim().toLowerCase();
    if (values.country.trim()) next.country = values.country.trim();
    if (values.city.trim()) next.city = values.city.trim();
    if (values.tz.trim()) next.tz = values.tz.trim();
    if (values.language) next.language = values.language;
    if (values.staff) next.staff = values.staff;
    setSearchParams(createSearchParams(next));
  }

  function clearFilters() {
    setSearchParams(createSearchParams({ page: '1' }));
  }

  function goToPage(nextPage: number) {
    const f = filtersFromUrl;
    const next: Record<string, string> = { page: String(nextPage) };
    if (f.outcome) next.outcome = f.outcome;
    if (f.provider.trim()) next.provider = f.provider.trim().toLowerCase();
    if (f.country.trim()) next.country = f.country.trim();
    if (f.city.trim()) next.city = f.city.trim();
    if (f.tz.trim()) next.tz = f.tz.trim();
    if (f.language) next.language = f.language;
    if (f.staff) next.staff = f.staff;
    setSearchParams(createSearchParams(next));
  }

  const totalPages = useMemo(() => {
    if (!data?.count) return 1;
    return Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  }, [data?.count]);

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
    filtersFromUrl.outcome ||
      filtersFromUrl.provider.trim() ||
      filtersFromUrl.country.trim() ||
      filtersFromUrl.city.trim() ||
      filtersFromUrl.tz.trim() ||
      filtersFromUrl.language ||
      filtersFromUrl.staff,
  );

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('loginEventsTitle')}
          </h1>
          <Badge variant="secondary" className="font-mono text-[10px] uppercase">
            {t('loginEventsBadge')}
          </Badge>
        </div>
        <Text className="max-w-3xl text-sm text-muted-foreground">{t('loginEventsDescription')}</Text>
      </header>

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
              <span className="font-heading text-sm font-semibold tracking-tight">{t('loginEventsSidebarSummary')}</span>
              <ChevronDown
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="space-y-4 border-t border-border/60 px-4 pb-4 pt-4 lg:border-t-0 lg:px-0 lg:pb-0 lg:pt-0">
              <div className="space-y-4">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-base">{t('loginEventsStat24hTitle')}</CardTitle>
                    <CardDescription className="text-xs">{t('loginEventsStat24hHint')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!accessToken ? (
                      <p className="text-sm text-muted-foreground">{t('loginEventsNoSession')}</p>
                    ) : loading24h ? (
                      <Skeleton className="h-10 w-24" />
                    ) : error24h ? (
                      <p className="text-sm text-destructive">{error24h}</p>
                    ) : (
                      <p className="font-mono text-3xl font-semibold tabular-nums">{count24h ?? '—'}</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-base">{t('loginEventsStatTotalTitle')}</CardTitle>
                    <CardDescription className="text-xs">{t('loginEventsStatTotalHint')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!accessToken ? (
                      <p className="text-sm text-muted-foreground">{t('loginEventsNoSession')}</p>
                    ) : loading && !data ? (
                      <Skeleton className="h-10 w-24" />
                    ) : error ? (
                      <p className="text-sm text-destructive">{error}</p>
                    ) : (
                      <p className="font-mono text-3xl font-semibold tabular-nums">{data?.count ?? '—'}</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/80 shadow-sm">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="font-heading text-lg">{t('loginEventsFiltersTitle')}</CardTitle>
                  <CardDescription className="text-sm">{t('loginEventsFiltersDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!accessToken ? (
                    <p className="text-sm text-muted-foreground">{t('loginEventsNoSession')}</p>
                  ) : (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        <div className="grid grid-cols-1 gap-4">
                          <FormField
                            control={form.control}
                            name="outcome"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {t('loginEventsFieldOutcome')}
                                </FormLabel>
                                <FormControl>
                                  <select {...field} className={selectFieldClassName()}>
                                    <option value="">{t('loginEventsFilterAny')}</option>
                                    <option value="success">{t('loginEventsOutcomeSuccess')}</option>
                                    <option value="failure">{t('loginEventsOutcomeFailure')}</option>
                                  </select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="staff"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {t('loginEventsFieldStaff')}
                                </FormLabel>
                                <FormControl>
                                  <select {...field} className={selectFieldClassName()}>
                                    <option value="">{t('loginEventsFilterAny')}</option>
                                    <option value="true">{t('usersStaffYes')}</option>
                                    <option value="false">{t('usersStaffNo')}</option>
                                  </select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="language"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {t('loginEventsFieldLanguage')}
                                </FormLabel>
                                <FormControl>
                                  <select {...field} className={selectFieldClassName()}>
                                    <option value="">{t('loginEventsFilterAny')}</option>
                                    <option value="en">{t('loginEventsLanguageEn')}</option>
                                    <option value="fr">{t('loginEventsLanguageFr')}</option>
                                  </select>
                                </FormControl>
                                <FormMessage />
                                <p className="text-[11px] text-muted-foreground">{t('loginEventsFieldLanguageHint')}</p>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="provider"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {t('loginEventsFieldProvider')}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="font-mono text-sm"
                                    placeholder={t('loginEventsFieldProviderPlaceholder')}
                                    autoComplete="off"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {t('loginEventsFieldCountry')}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="text-sm"
                                    placeholder={t('loginEventsFieldCountryPlaceholder')}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {t('loginEventsFieldCity')}
                                </FormLabel>
                                <FormControl>
                                  <Input className="text-sm" placeholder={t('loginEventsFieldCityPlaceholder')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="tz"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {t('loginEventsFieldTimezone')}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="font-mono text-sm"
                                    placeholder={t('loginEventsFieldTimezonePlaceholder')}
                                    autoComplete="off"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            disabled={loading}
                            className="w-full sm:w-auto"
                          >
                            {t('loginEventsApplyFilters')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loading || !hasActiveFilters}
                            className="w-full sm:w-auto"
                            onClick={clearFilters}
                          >
                            {t('loginEventsClearFilters')}
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

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          {accessToken && hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[11px]">
                {t('loginEventsFiltersActive')}
              </Badge>
            </div>
          ) : null}

          <section aria-label={t('loginEventsListAria')}>
        {accessToken && loading && !data ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span className="text-sm">{t('loginEventsLoading')}</span>
          </div>
        ) : null}
        {error && data === null && !loading ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {data && rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('loginEventsEmpty')}</p>
        ) : null}
        {rows.length > 0 ? (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {t('loginEventsListingSummary', {
                shown: rows.length,
                total: data?.count ?? 0,
                page: pageParam,
                pages: totalPages,
              })}
            </p>
            <div className="rounded-md border border-border">
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[36rem] md:min-w-[52rem] lg:min-w-[60rem]">
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-[4rem] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('usersColId')}
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('userDetailLoginColWhen')}
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('userDetailLoginColOutcome')}
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('userDetailLoginColProvider')}
                      </TableHead>
                      <TableHead className="min-w-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('usersColUser')}
                      </TableHead>
                      <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('userDetailLoginColStaff')}
                      </TableHead>
                      <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('loginEventsColLocation')}
                      </TableHead>
                      <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('userDetailLoginColTimezone')}
                      </TableHead>
                      <TableHead className="hidden w-[5rem] text-right text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">
                        {t('usersColActions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="font-mono text-xs">
                    {rows.map((ev) => {
                      const href = `/login-events/${ev.id}`;
                      const locationLabel =
                        [ev.client_city, ev.client_country].filter(Boolean).join(', ') || '—';
                      const userLabel =
                        ev.user_id != null
                          ? t('loginEventsRowUser', {
                              email: ev.user_email || String(ev.user_id),
                            })
                          : t('loginEventsRowAnonymous');
                      return (
                        <TableRow key={ev.id} className="hover:bg-muted/40">
                          <TableCell className="tabular-nums text-muted-foreground">
                            <Link
                              to={href}
                              className="text-primary underline-offset-2 hover:underline"
                              aria-label={t('loginEventsDetailTitle', { id: ev.id })}
                            >
                              {ev.id}
                            </Link>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            <Link
                              to={href}
                              className="text-primary underline-offset-2 hover:underline"
                              aria-label={t('loginEventsDetailTitle', { id: ev.id })}
                            >
                              {formatShortDateTime(ev.created_at)}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 font-medium',
                                ev.outcome === 'success'
                                  ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-destructive/15 text-destructive',
                              )}
                            >
                              {ev.outcome}
                            </span>
                            {ev.failure_reason ? (
                              <span
                                className="mt-1 block max-w-[12rem] truncate text-[10px] text-muted-foreground md:max-w-[14rem]"
                                title={ev.failure_reason}
                              >
                                {ev.failure_reason}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell>{ev.provider}</TableCell>
                          <TableCell className="max-w-[10rem] truncate sm:max-w-[14rem] lg:max-w-[18rem]" title={userLabel}>
                            {userLabel}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {ev.is_staff_at_event ? t('usersStaffYes') : t('usersStaffNo')}
                          </TableCell>
                          <TableCell className="hidden max-w-[10rem] truncate md:table-cell" title={locationLabel}>
                            {locationLabel}
                          </TableCell>
                          <TableCell className="hidden max-w-[9rem] truncate font-mono text-[10px] lg:table-cell" title={ev.client_timezone || undefined}>
                            {ev.client_timezone || '—'}
                          </TableCell>
                          <TableCell className="hidden text-right sm:table-cell">
                            <Link
                              to={href}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {t('loginEventsOpenDetail')}
                            </Link>
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
                  {t('loginEventsPageStatus', { page: pageParam, pages: totalPages, total: data?.count ?? 0 })}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pageParam <= 1 || loading}
                    className="min-w-[7rem] sm:min-w-0"
                    onClick={() => goToPage(Math.max(1, pageParam - 1))}
                  >
                    {t('usersPrevPage')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pageParam >= totalPages || loading}
                    className="min-w-[7rem] sm:min-w-0"
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
