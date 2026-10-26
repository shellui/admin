import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, createSearchParams, useNavigate, useSearchParams } from 'react-router-dom';
import shellui from '@shellui/sdk';
import { AlertCircle, Loader2, MoreHorizontal, Search, UserPlus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTableCard, SkeletonRows, TablePager } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { InitialsAvatar } from '@/components/admin/InitialsAvatar';
import { StatusBadge, TagPill } from '@/components/admin/StatusBadge';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import {
  fetchAdminUsers,
  updateAdminUser,
  type AdminUserListResponse,
  type AdminUserRow,
} from '@/lib/adminUsersApi';
import { openInviteUserModal } from '@/lib/inviteModal';
import { PendingInvitationsButton } from '@/components/PendingInvitationsButton';

/** Page size for directory fetch; use `page` in URL for additional pages (full directory is all pages together). */
const PAGE_SIZE = 50;

const HEAD = 'h-10 text-[12.5px] font-medium text-muted-foreground';
const SKELETON_COLUMNS = [
  'w-[38%]',
  'hidden lg:table-cell',
  'hidden lg:table-cell',
  'hidden md:table-cell',
  '',
  'w-12',
];

function avatarFromRow(row: AdminUserRow): string | null {
  const u = row.user_metadata?.avatar_url;
  return typeof u === 'string' && u.trim() ? u.trim() : null;
}

function lastSeenFromRow(row: AdminUserRow): string | null {
  const v = row.user_metadata?.last_seen_at;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function displayName(row: AdminUserRow): string {
  const meta = row.user_metadata ?? {};
  if (typeof meta.full_name === 'string' && meta.full_name.trim()) return meta.full_name;
  const combined = `${row.first_name} ${row.last_name}`.trim();
  return combined || row.username || row.email;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function UsersListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useShelluiAccessToken();
  const searchRef = useRef<HTMLInputElement>(null);

  const qParam = searchParams.get('q') ?? '';
  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const hasSearch = qParam.trim().length > 0;

  const [query, setQuery] = useState(qParam);
  useEffect(() => {
    setQuery(qParam);
  }, [qParam]);

  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

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
      const res = await fetchAdminUsers(accessToken, {
        q: qParam || undefined,
        page: pageParam,
        pageSize: PAGE_SIZE,
      });
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

  // `/` focuses the search field, like most directories.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    setSearchParams(createSearchParams({ ...(q ? { q } : {}), page: '1' }));
  }

  function goToPage(nextPage: number) {
    setSearchParams(
      createSearchParams({ ...(qParam ? { q: qParam } : {}), page: String(nextPage) }),
    );
  }

  function clearSearch() {
    setQuery('');
    setSearchParams(createSearchParams({ page: '1' }));
  }

  async function setAccess(row: AdminUserRow, enabled: boolean) {
    if (!accessToken || togglingId != null || row.is_active === enabled) return;
    setTogglingId(row.id);
    try {
      const updated = await updateAdminUser(accessToken, row.id, { is_active: enabled });
      setData((prev) =>
        prev
          ? {
              ...prev,
              results: prev.results.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
            }
          : prev,
      );
      shellui.toast({
        title: enabled ? t('usersAccessEnabledToast') : t('usersAccessDisabledToast'),
        type: 'success',
      });
    } catch (e) {
      shellui.toast({
        title: t('usersAccessErrorToast'),
        description: e instanceof Error ? e.message : t('usersErrorUnknown'),
        type: 'error',
      });
    } finally {
      setTogglingId(null);
    }
  }

  const totalPages = useMemo(() => {
    if (!data?.count) return 1;
    return Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  }, [data?.count]);

  const formatShortDateTime = (iso: string | null) => {
    if (!iso) return t('usersNever');
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(i18n.language || 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  };

  const rows = data?.results ?? [];
  const showEmpty = !loading && data && rows.length === 0;

  const toolbar = (
    <>
      <form
        onSubmit={onSubmit}
        role="search"
        className="flex w-full min-w-0 items-center gap-2 sm:w-auto"
      >
        <label
          htmlFor="users-search"
          className="sr-only"
        >
          {t('usersFieldQuery')}
        </label>
        <div className="relative w-full sm:w-[22rem]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="users-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('usersFieldQueryPlaceholder')}
            autoComplete="off"
            aria-describedby="users-search-help"
            className="h-9 pl-9 pr-9"
          />
          <kbd
            className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 items-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground sm:inline-flex"
            title={t('usersSearchShortcut')}
          >
            /
          </kbd>
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={loading}
        >
          {t('usersFormSearch')}
        </Button>
      </form>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {hasSearch ? (
          <span className="inline-flex h-7 max-w-[22rem] items-center gap-1 rounded-full border border-border bg-muted pl-2.5 pr-1 text-xs">
            <span className="truncate">
              {t('usersFilterBadgePrefix')}: {qParam}
            </span>
            <button
              type="button"
              onClick={clearSearch}
              aria-label={t('usersClearSearch')}
              className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X
                className="size-3.5"
                aria-hidden
              />
            </button>
          </span>
        ) : null}
        <p
          id="users-search-help"
          className="text-xs text-muted-foreground"
        >
          {t('usersSearchHelp')}
        </p>
      </div>
    </>
  );

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('usersTitle')}
        service={t('usersSchemaBadge')}
        description={t('usersDescription')}
        actions={
          accessToken ? (
            <>
              <PendingInvitationsButton accessToken={accessToken} />
              <Button
                type="button"
                onClick={openInviteUserModal}
              >
                <UserPlus aria-hidden />
                {t('inviteAction')}
              </Button>
            </>
          ) : null
        }
      />

      {!accessToken ? (
        <Alert variant="info">
          <Loader2
            className="size-4 animate-spin"
            aria-hidden
          />
          <AlertDescription>{t('usersNoSession')}</AlertDescription>
        </Alert>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle
            className="size-4"
            aria-hidden
          />
          <AlertTitle>{t('usersLoadErrorTitle')}</AlertTitle>
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
      ) : (
        <DataTableCard
          label={t('usersTableTitle')}
          busy={loading}
          toolbar={toolbar}
          footer={
            data && data.count > 0 ? (
              <>
                <p
                  className="sr-only"
                  aria-live="polite"
                >
                  {t('usersListingSummary', {
                    shown: rows.length,
                    total: data.count,
                    page: pageParam,
                    pages: totalPages,
                  })}
                </p>
                <TablePager
                  status={t('usersPageStatus', {
                    page: pageParam,
                    pages: totalPages,
                    total: data.count,
                  })}
                  previousLabel={t('usersPrevPage')}
                  nextLabel={t('usersNextPage')}
                  canPrevious={pageParam > 1 && !loading}
                  canNext={pageParam < totalPages && !loading}
                  onPrevious={() => goToPage(pageParam - 1)}
                  onNext={() => goToPage(pageParam + 1)}
                />
              </>
            ) : null
          }
        >
          {showEmpty ? (
            hasSearch ? (
              <EmptyState
                icon={Search}
                title={t('usersEmpty')}
                description={t('usersEmptySearchHint')}
                actions={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearSearch}
                  >
                    {t('usersClearSearch')}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Users}
                title={t('usersEmptyTitle')}
                description={t('usersEmptyDescription')}
                actions={
                  <Button
                    type="button"
                    size="sm"
                    onClick={openInviteUserModal}
                  >
                    <UserPlus aria-hidden />
                    {t('inviteAction')}
                  </Button>
                }
              />
            )
          ) : (
            <Table className="w-full">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${HEAD} w-[38%] pl-4`}>{t('usersColUser')}</TableHead>
                  <TableHead className={`${HEAD} hidden lg:table-cell`}>
                    {t('usersColUsername')}
                  </TableHead>
                  <TableHead className={`${HEAD} hidden lg:table-cell`}>
                    {t('usersColGroups')}
                  </TableHead>
                  <TableHead className={`${HEAD} hidden md:table-cell`}>
                    {t('usersColLastSeen')}
                  </TableHead>
                  <TableHead className={HEAD}>{t('usersColAccess')}</TableHead>
                  <TableHead className={`${HEAD} w-12`}>
                    <span className="sr-only">{t('usersColActions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !data ? <SkeletonRows columns={SKELETON_COLUMNS} /> : null}
                {rows.map((row) => {
                  const name = displayName(row);
                  const groups = row.groups ?? [];
                  const busy = togglingId === row.id;
                  return (
                    <TableRow
                      key={row.id}
                      className={`h-14 hover:bg-muted/60 ${loading ? 'opacity-60' : ''}`}
                    >
                      <TableCell className="min-w-0 p-0">
                        <Link
                          to={`/users/${row.id}`}
                          className="group flex min-w-0 items-center gap-3 px-4 py-2 text-left no-underline outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          aria-label={t('usersRowOpenProfile', { name })}
                        >
                          <InitialsAvatar
                            name={name}
                            email={row.email}
                            imageUrl={avatarFromRow(row)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground group-hover:underline group-hover:underline-offset-4">
                                {name}
                              </span>
                              {row.is_company_owner ? (
                                <StatusBadge
                                  tone="gold"
                                  dot={false}
                                >
                                  {t('usersColOwner')}
                                </StatusBadge>
                              ) : null}
                            </span>
                            <span
                              className="block truncate text-[12.5px] text-muted-foreground"
                              title={row.email}
                            >
                              {row.email}
                            </span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell
                        className="hidden max-w-[10rem] truncate font-mono text-xs text-muted-foreground lg:table-cell"
                        title={row.username}
                      >
                        {row.username}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {groups.length ? (
                          <div className="flex flex-wrap gap-1">
                            {groups.map((g) => (
                              <TagPill
                                key={g.id}
                                title={g.name}
                              >
                                {g.name}
                              </TagPill>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('usersNone')}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm tabular-nums text-muted-foreground md:table-cell">
                        {formatShortDateTime(lastSeenFromRow(row))}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Switch
                            checked={row.is_active}
                            disabled={busy || togglingId != null}
                            aria-label={t('usersAccessSelectLabel', { name })}
                            onCheckedChange={(checked) => void setAccess(row, checked)}
                          />
                          {busy ? (
                            <Loader2
                              className="size-3.5 animate-spin text-muted-foreground"
                              aria-hidden
                            />
                          ) : (
                            <StatusBadge
                              tone={row.is_active ? 'success' : 'muted'}
                              className="hidden sm:inline-flex"
                            >
                              {row.is_active ? t('usersActiveYes') : t('usersActiveNo')}
                            </StatusBadge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pr-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={t('usersMoreActions', { name })}
                            >
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => navigate(`/users/${row.id}`)}>
                              {t('usersOpenProfile')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTableCard>
      )}
    </div>
  );
}
