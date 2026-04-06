import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, createSearchParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { fetchAdminUsers, type AdminUserListResponse, type AdminUserRow } from '@/lib/adminUsersApi';

/** Page size for directory fetch; use `page` in URL for additional pages (full directory is all pages together). */
const PAGE_SIZE = 50;

const filterSchema = z.object({
  query: z.string(),
});

type FilterValues = z.infer<typeof filterSchema>;

function avatarFromRow(row: AdminUserRow): string | null {
  const u = row.user_metadata?.avatar_url;
  return typeof u === 'string' && u.trim() ? u.trim() : null;
}

function lastSeenFromRow(row: AdminUserRow): string | null {
  const v = row.user_metadata?.last_seen_at;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function UsersListPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useShelluiAccessToken();

  const qParam = searchParams.get('q') ?? '';
  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const hasSearch = qParam.trim().length > 0;

  const form = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: { query: qParam },
  });

  const { reset: resetFilterForm } = form;
  useEffect(() => {
    resetFilterForm({ query: qParam });
  }, [qParam, resetFilterForm]);

  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetchAdminUsers(accessToken, { q: qParam || undefined, page: pageParam, pageSize: PAGE_SIZE });
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : t('usersErrorUnknown'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, qParam, pageParam, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSubmit(values: FilterValues) {
    setSearchParams(
      createSearchParams({
        ...(values.query.trim() ? { q: values.query.trim() } : {}),
        page: '1',
      }),
    );
  }

  function goToPage(nextPage: number) {
    setSearchParams(
      createSearchParams({
        ...(qParam ? { q: qParam } : {}),
        page: String(nextPage),
      }),
    );
  }

  function clearSearch() {
    // Remove `q` from URL and reset pagination to page 1.
    setSearchParams(
      createSearchParams({
        page: '1',
      }),
    );
  }

  const totalPages = useMemo(() => {
    if (!data?.count) return 1;
    return Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  }, [data?.count]);

  const displayName = (row: { first_name: string; last_name: string; user_metadata: Record<string, unknown> }) => {
    const meta = row.user_metadata;
    if (typeof meta.full_name === 'string' && meta.full_name.trim()) return meta.full_name;
    const combined = `${row.first_name} ${row.last_name}`.trim();
    return combined || '—';
  };

  const formatShortDateTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(i18n.language || 'en', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  };

  const rows = data?.results ?? [];
  const shownCount = rows.length;

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{t('usersTitle')}</h1>
          <Badge variant="secondary" className="font-mono text-[10px] uppercase">
            {t('usersSchemaBadge')}
          </Badge>
        </div>
        <Text className="max-w-3xl text-sm text-muted-foreground">{t('usersDescription')}</Text>
      </header>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="font-heading text-lg">{t('usersTableTitle')}</CardTitle>
          <CardDescription className="text-sm">{t('usersTableDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter toolbar — always above the data table */}
          {!accessToken ? (
            <p className="text-sm text-muted-foreground">{t('usersNoSession')}</p>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
                <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('usersFieldQuery')}
                      </FormLabel>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <FormControl className="w-full flex-1 sm:min-w-0">
                          <Input
                            className="w-full font-mono text-sm"
                            placeholder={t('usersFieldQueryPlaceholder')}
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type="submit"
                          variant="secondary"
                          size="sm"
                          disabled={loading}
                          className="w-full shrink-0 sm:w-auto"
                        >
                          {t('usersFormSearch')}
                        </Button>
                      </div>
                      <FormDescription className="text-xs">{t('usersFieldQueryHint')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          )}

          {accessToken && hasSearch ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-[11px]">
                <span className="max-w-[26ch] truncate">
                  {t('usersFilterBadgePrefix')}: {qParam}
                </span>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="ml-2 inline-flex size-4 items-center justify-center rounded border border-border/60 bg-background/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  aria-label={t('usersClearSearch')}
                >
                  ×
                </button>
              </Badge>
            </div>
          ) : null}

          {accessToken && data && !loading ? (
            <p className="text-xs text-muted-foreground">
              {t('usersListingSummary', {
                shown: shownCount,
                total: data.count,
                page: pageParam,
                pages: totalPages,
              })}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {/* Full-width array table */}
          {accessToken && !error ? (
            <div className="relative rounded-md border border-border">
              {loading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/65 backdrop-blur-[1px]">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
                  <span className="sr-only">{t('usersLoading')}</span>
                </div>
              ) : null}
              <div className="w-full overflow-x-auto">
                <Table className="w-full min-w-[min(100%,22rem)] table-fixed md:min-w-[44rem] lg:min-w-[56rem] xl:min-w-[72rem]">
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-[3.5rem] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('usersColId')}
                      </TableHead>
                      <TableHead className="w-[38%] min-w-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('usersColUser')}
                      </TableHead>
                      <TableHead className="hidden lg:table-cell w-[18%] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('usersColGroups')}
                      </TableHead>
                      <TableHead className="hidden md:table-cell w-[5rem] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('usersColStaff')}
                      </TableHead>
                      <TableHead className="hidden md:table-cell w-[5rem] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('usersColActive')}
                      </TableHead>
                      <TableHead className="hidden xl:table-cell w-[10%] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('usersColUsername')}
                      </TableHead>
                      <TableHead className="hidden xl:table-cell w-[11rem] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('usersColLastSeen')}
                      </TableHead>
                      <TableHead className="hidden w-[4.5rem] text-right text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">
                        {t('usersColActions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="font-mono text-xs">
                    {loading && !data
                      ? Array.from({ length: 6 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Skeleton className="h-4 w-8" />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Skeleton className="hidden size-8 shrink-0 rounded-full sm:block" />
                                <div className="min-w-0 flex-1 space-y-1">
                                  <Skeleton className="h-4 w-full max-w-[12rem]" />
                                  <Skeleton className="h-3 w-full max-w-[14rem]" />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Skeleton className="h-4 w-8" />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Skeleton className="h-4 w-8" />
                            </TableCell>
                            <TableCell className="hidden xl:table-cell">
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell className="hidden xl:table-cell">
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell className="hidden sm:table-cell" />
                          </TableRow>
                        ))
                      : null}
                    {!loading && data && rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                          {t('usersEmpty')}
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {rows.map((row) => {
                      const av = avatarFromRow(row);
                      return (
                        <TableRow key={row.id} className="hover:bg-muted/40">
                          <TableCell className="tabular-nums text-muted-foreground">{row.id}</TableCell>
                          <TableCell className="min-w-0 p-0">
                            <Link
                              to={`/users/${row.id}`}
                              className="group flex items-start gap-2 rounded-md px-2 py-2 text-left no-underline outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              aria-label={t('usersRowOpenProfile', { name: displayName(row) })}
                            >
                              <div className="hidden shrink-0 sm:block">
                                {av ? (
                                  <img src={av} alt="" className="size-8 rounded-full border border-border object-cover" />
                                ) : (
                                  <div
                                    className="flex size-8 items-center justify-center rounded-full border border-dashed border-border bg-muted text-[10px] font-medium text-muted-foreground"
                                    aria-hidden
                                  >
                                    {displayName(row).slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-sans text-sm font-medium text-primary underline-offset-4 group-hover:underline">
                                  {displayName(row)}
                                </div>
                                <div className="truncate font-mono text-[11px] text-muted-foreground" title={row.email}>
                                  {row.email}
                                </div>
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell className="hidden align-top lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {(row.groups ?? []).length ? (
                                (row.groups ?? []).map((g) => (
                                  <Badge
                                    key={g.id}
                                    variant="outline"
                                    className="max-w-[10rem] truncate text-[10px] font-normal"
                                    title={g.name}
                                  >
                                    {g.name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant={row.is_staff ? 'default' : 'outline'} className="text-[10px]">
                              {row.is_staff ? t('usersStaffYes') : t('usersStaffNo')}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant={row.is_active ? 'secondary' : 'muted'} className="text-[10px]">
                              {row.is_active ? t('usersActiveYes') : t('usersActiveNo')}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden truncate xl:table-cell" title={row.username}>
                            {row.username}
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">
                            {formatShortDateTime(lastSeenFromRow(row))}
                          </TableCell>
                          <TableCell className="hidden text-right sm:table-cell">
                            <Button variant="link" className="h-auto p-0 text-xs" asChild>
                              <Link to={`/users/${row.id}`}>{t('usersActionView')}</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {!loading && data && data.count > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {t('usersPageStatus', { page: pageParam, pages: totalPages, total: data.count })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pageParam <= 1 || loading}
                      onClick={() => goToPage(pageParam - 1)}
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
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
