import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HardDrive, Loader2, Rocket, ScrollText, Trash2, UserCheck, UserX } from 'lucide-react';
import shellui from '@shellui/sdk';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { InitialsAvatar } from '@/components/admin/InitialsAvatar';
import { CheckTile, CheckTiles, DangerCard, DefinitionList } from '@/components/admin/Extras';
import { TablePager } from '@/components/admin/DataTableCard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { useShelluiIsStaff } from '@/hooks/useShelluiIsStaff';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import { getUserIdFromJwt } from '@/lib/jwtCompany';
import {
  deleteAdminUser,
  fetchAdminUser,
  updateAdminUser,
  type AdminUserRow,
  type ShellUIPreferencesPayload,
} from '@/lib/adminUsersApi';
import { fetchAdminGroups, type AdminGroupRow } from '@/lib/adminGroupsApi';
import { useEventLogSource } from '@/hooks/useEventRetention';
import {
  eventDetailPath,
  eventSummary,
  fetchEventLog,
  isFailureEvent,
  type EventLogListResponse,
} from '@/lib/eventLogApi';
import { cn } from '@/lib/utils';

type ActivityTab = 'identity' | 'storage' | 'hosting';

/** Keep moderate to limit JSON payload per request. */
const EVENTS_PAGE_SIZE = 15;

function parsePreferences(meta: Record<string, unknown>): ShellUIPreferencesPayload | null {
  const raw = meta.shelluiPreferences;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    themeName: typeof o.themeName === 'string' ? o.themeName : null,
    language: typeof o.language === 'string' ? o.language : null,
    region: typeof o.region === 'string' ? o.region : null,
    colorScheme: typeof o.colorScheme === 'string' ? o.colorScheme : null,
  };
}

function avatarUrlFromUser(user: AdminUserRow): string | null {
  const u = user.user_metadata.avatar_url;
  return typeof u === 'string' && u.trim() ? u.trim() : null;
}

function lastSeenFromUser(user: AdminUserRow): string | null {
  const v = user.user_metadata.last_seen_at;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function displayName(user: AdminUserRow): string {
  const meta = user.user_metadata;
  if (typeof meta.full_name === 'string' && meta.full_name.trim()) return meta.full_name.trim();
  const combined = `${user.first_name} ${user.last_name}`.trim();
  return combined || user.username || user.email || '-';
}

function formatDateTime(iso: string | undefined, locale: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export function UserDetailPage() {
  const { t, i18n } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const accessToken = useShelluiAccessToken();
  const actorIsStaff = useShelluiIsStaff();
  const idNum = userId ? parseInt(userId, 10) : NaN;
  const identityEvents = useEventLogSource('identity');
  const storageEvents = useEventLogSource('storage');
  const hostingEvents = useEventLogSource('hosting');
  const [activityTab, setActivityTab] = useState<ActivityTab>('identity');
  const activeEvents =
    activityTab === 'storage'
      ? storageEvents
      : activityTab === 'hosting'
        ? hostingEvents
        : identityEvents;

  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [events, setEvents] = useState<EventLogListResponse | null>(null);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsInView, setEventsInView] = useState(false);
  const eventsSectionRef = useRef<HTMLDivElement>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [allGroups, setAllGroups] = useState<AdminGroupRow[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingAccess, setTogglingAccess] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadUser = useCallback(async () => {
    if (!accessToken || !Number.isFinite(idNum)) {
      setLoadingUser(false);
      return;
    }
    setLoadingUser(true);
    setLoadError(null);
    try {
      const [u, groups] = await Promise.all([
        fetchAdminUser(accessToken, idNum),
        fetchAdminGroups(accessToken),
      ]);
      setUser(u);
      setAllGroups(groups);
      setSelectedGroupIds((u.groups ?? []).map((g) => g.id));
      setSaveError(null);
    } catch (e) {
      setUser(null);
      setLoadError(e instanceof Error ? e.message : t('usersErrorUnknown'));
    } finally {
      setLoadingUser(false);
    }
  }, [accessToken, idNum, t]);

  const loadEvents = useCallback(async () => {
    if (!eventsInView || !accessToken || !activeEvents || !Number.isFinite(idNum)) {
      return;
    }
    setLoadingEvents(true);
    setEventsError(null);
    try {
      const ev = await fetchEventLog(activeEvents, accessToken, {
        userId: idNum,
        page: eventsPage,
        pageSize: EVENTS_PAGE_SIZE,
      });
      setEvents(ev);
    } catch (e) {
      setEvents(null);
      setEventsError(e instanceof Error ? e.message : t('usersErrorUnknown'));
    } finally {
      setLoadingEvents(false);
    }
  }, [eventsInView, accessToken, activeEvents, idNum, eventsPage, t]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    setEventsPage(1);
    setEvents(null);
    setEventsError(null);
    setEventsInView(false);
    setLoadingEvents(false);
  }, [idNum]);

  const hasUser = user !== null;
  useEffect(() => {
    const el = eventsSectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setEventsInView(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin: '160px 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [idNum, hasUser]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const preferences = useMemo(() => (user ? parsePreferences(user.user_metadata) : null), [user]);
  const actorUserId = useMemo(
    () => (accessToken ? getUserIdFromJwt(accessToken) : null),
    [accessToken],
  );
  const canDelete = !!user && user.id !== actorUserId && (!user.is_staff || actorIsStaff);

  const eventsTotalPages = useMemo(() => {
    if (!events?.count) return 1;
    const ps = events.page_size > 0 ? events.page_size : EVENTS_PAGE_SIZE;
    return Math.max(1, Math.ceil(events.count / ps));
  }, [events?.count, events?.page_size]);

  if (!Number.isFinite(idNum)) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('userDetailInvalidId')}</AlertDescription>
      </Alert>
    );
  }

  const locale = i18n.language || 'en';

  async function onSaveMembership() {
    if (!accessToken || !Number.isFinite(idNum) || !user) return;
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await updateAdminUser(accessToken, idNum, {
        group_ids: selectedGroupIds,
      });
      setUser(updated);
      setSelectedGroupIds((updated.groups ?? []).map((g) => g.id));
      shellui.toast({ title: t('userDetailSaved'), type: 'success' });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('usersErrorUnknown'));
    } finally {
      setSaving(false);
    }
  }

  async function onToggleAccess() {
    if (!accessToken || !Number.isFinite(idNum) || !user || togglingAccess) return;
    setSaveError(null);
    setTogglingAccess(true);
    try {
      const updated = await updateAdminUser(accessToken, idNum, {
        is_active: !user.is_active,
      });
      setUser(updated);
      shellui.toast({
        title: updated.is_active ? t('usersAccessEnabledToast') : t('usersAccessDisabledToast'),
        type: 'success',
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('usersErrorUnknown'));
    } finally {
      setTogglingAccess(false);
    }
  }

  async function onDeleteUser() {
    if (!accessToken || !Number.isFinite(idNum) || !user || deleting) return;
    const name = displayName(user);
    const confirmed = await askShelluiConfirm({
      title: t('userDetailDeleteConfirmTitle', { name }),
      description: t('userDetailDeleteConfirm', { name }),
      okLabel: t('userDetailDeleteAction'),
      cancelLabel: t('userDetailDeleteCancel'),
      mode: 'delete',
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteAdminUser(accessToken, idNum);
      shellui.toast({ title: t('userDetailDeleted'), type: 'success' });
      navigate('/users', { replace: true });
    } catch (e) {
      shellui.toast({
        title: t('userDetailDeleteTitle'),
        description: e instanceof Error ? e.message : t('usersErrorUnknown'),
        type: 'error',
      });
      setDeleting(false);
    }
  }

  const dirty =
    !!user &&
    [...selectedGroupIds].sort().join(',') !==
      (user.groups ?? [])
        .map((g) => g.id)
        .sort()
        .join(',');

  const tabs: { key: ActivityTab; label: string; enabled: boolean }[] = [
    { key: 'identity', label: t('userDetailTabIdentity'), enabled: Boolean(identityEvents) },
    { key: 'storage', label: t('userDetailTabStorage'), enabled: Boolean(storageEvents) },
    { key: 'hosting', label: t('userDetailTabHosting'), enabled: Boolean(hostingEvents) },
  ];
  const KindIcon =
    activityTab === 'storage' ? HardDrive : activityTab === 'hosting' ? Rocket : ScrollText;

  const cardTitle = 'font-heading text-[15px] font-semibold';

  return (
    <div className="w-full space-y-6">
      {!user ? (
        <PageHeader
          title={t('userDetailTitle')}
          back={{ to: '/users', label: t('userDetailBackToUsers') }}
        />
      ) : (
        <PageHeader
          back={{ to: '/users', label: t('userDetailBackToUsers') }}
          title={
            <span className="flex items-center gap-3">
              <InitialsAvatar
                name={displayName(user)}
                email={user.email}
                imageUrl={avatarUrlFromUser(user)}
                className="size-11 text-sm"
              />
              <span>
                <span className="sr-only">{t('userDetailTitle')}: </span>
                {displayName(user)}
              </span>
            </span>
          }
          service="shellui-auth"
          description={
            <span>
              {user.email} · {t('userDetailIdLine', { id: user.id })}
            </span>
          }
          actions={
            <>
              <StatusBadge tone={user.is_active ? 'success' : 'muted'}>
                {user.is_active ? t('usersActiveYes') : t('usersActiveNo')}
              </StatusBadge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={togglingAccess}
                onClick={() => void onToggleAccess()}
                className="inline-flex items-center gap-2"
              >
                {togglingAccess ? (
                  <Loader2
                    className="size-4 animate-spin"
                    aria-hidden
                  />
                ) : user.is_active ? (
                  <UserX
                    className="size-4"
                    aria-hidden
                  />
                ) : (
                  <UserCheck
                    className="size-4"
                    aria-hidden
                  />
                )}
                {user.is_active ? t('usersActionDisable') : t('usersActionEnable')}
              </Button>
            </>
          }
        />
      )}

      {!accessToken ? (
        <Text className="text-sm text-muted-foreground">{t('usersNoSession')}</Text>
      ) : loadError && !user ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{loadError}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadUser()}
            >
              {t('usersRetry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : loadingUser && !user ? (
        <div
          className="space-y-4"
          aria-busy
        >
          <span className="sr-only">{t('userDetailLoading')}</span>
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      ) : user ? (
        <>
          {saveError ? (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          ) : null}

          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className={cardTitle}>{t('userDetailProfile')}</CardTitle>
            </CardHeader>
            <CardContent>
              <DefinitionList
                items={[
                  {
                    key: 'u',
                    term: t('userDetailUsername'),
                    value: <span className="font-mono">{user.username || '-'}</span>,
                  },
                  {
                    key: 'id',
                    term: t('userDetailId'),
                    value: <span className="font-mono">{user.id}</span>,
                  },
                  { key: 'fn', term: t('userDetailFirstName'), value: user.first_name || '-' },
                  { key: 'ln', term: t('userDetailLastName'), value: user.last_name || '-' },
                  {
                    key: 'ls',
                    term: t('userDetailLastSeen'),
                    value: lastSeenFromUser(user)
                      ? formatDateTime(lastSeenFromUser(user)!, locale)
                      : t('usersNever'),
                  },
                  {
                    key: 'st',
                    term: t('usersColStaff'),
                    value: user.is_staff ? t('usersStaffYes') : t('usersStaffNo'),
                  },
                  {
                    key: 'ac',
                    term: t('usersColAccess'),
                    value: user.is_active ? t('usersActiveYes') : t('usersActiveNo'),
                  },
                ]}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
            <Card className="flex flex-col overflow-hidden shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className={cardTitle}>{t('userDetailMembershipTitle')}</CardTitle>
                <CardDescription>{t('userDetailGroupsHint')}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {allGroups.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border p-4">
                    <p className="text-sm text-muted-foreground">{t('userDetailGroupsEmpty')}</p>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                    >
                      <Link to="/groups">{t('userDetailOpenGroups')}</Link>
                    </Button>
                  </div>
                ) : (
                  <CheckTiles>
                    {allGroups.map((g) => {
                      const checked = selectedGroupIds.includes(g.id);
                      const id = `user-detail-group-${g.id}`;
                      return (
                        <CheckTile
                          key={g.id}
                          htmlFor={id}
                          label={g.display_name}
                          hint={g.source === 'scim' ? t('userDetailScimSynced') : undefined}
                          control={
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={() =>
                                setSelectedGroupIds((prev) =>
                                  checked ? prev.filter((x) => x !== g.id) : [...prev, g.id],
                                )
                              }
                            />
                          }
                        />
                      );
                    })}
                  </CheckTiles>
                )}
              </CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/60 px-5 py-3">
                <span className="font-mono text-xs text-muted-foreground">
                  PATCH /api/v1/users/{user.id}
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving || !dirty}
                  onClick={() => void onSaveMembership()}
                >
                  {saving ? t('userDetailSaving') : t('userDetailSave')}
                </Button>
              </div>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className={cardTitle}>{t('userDetailPreferencesTitle')}</CardTitle>
                <CardDescription>{t('userDetailPrefsHint')}</CardDescription>
              </CardHeader>
              <CardContent>
                {!preferences ? (
                  <p className="text-sm text-muted-foreground">{t('userDetailPreferencesEmpty')}</p>
                ) : (
                  <DefinitionList
                    className="md:grid-cols-2"
                    items={[
                      {
                        key: 't',
                        term: t('userDetailPrefTheme'),
                        value: preferences.themeName ?? '-',
                      },
                      {
                        key: 'c',
                        term: t('userDetailPrefColorScheme'),
                        value: preferences.colorScheme ?? '-',
                      },
                      {
                        key: 'l',
                        term: t('userDetailPrefLanguage'),
                        value: preferences.language ?? '-',
                      },
                      {
                        key: 'r',
                        term: t('userDetailPrefRegion'),
                        value: preferences.region ?? '-',
                      },
                    ]}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div ref={eventsSectionRef}>
            <Card className="overflow-hidden shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className={cardTitle}>{t('userDetailEventsTitle')}</CardTitle>
                <CardDescription>{t('userDetailActivityHint')}</CardDescription>
                <Tabs
                  value={activityTab}
                  onValueChange={(v) => {
                    setActivityTab(v as ActivityTab);
                    setEventsPage(1);
                    setEvents(null);
                    setEventsError(null);
                  }}
                  className="pt-2"
                >
                  <TabsList className="max-w-full overflow-x-auto">
                    {tabs
                      .filter((tab) => tab.enabled)
                      .map((tab) => (
                        <TabsTrigger
                          key={tab.key}
                          value={tab.key}
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="p-0">
                {eventsError ? (
                  <div className="px-5 pb-4">
                    <Alert variant="destructive">
                      <AlertDescription>{eventsError}</AlertDescription>
                    </Alert>
                  </div>
                ) : null}
                {eventsInView && loadingEvents && !events ? (
                  <div
                    className="space-y-2 px-5 pb-4"
                    aria-busy
                  >
                    <span className="sr-only">{t('eventsLoading')}</span>
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : null}
                {events && events.results.length === 0 ? (
                  <p className="px-5 pb-4 text-sm text-muted-foreground">
                    {t('userDetailEventsEmpty')}
                  </p>
                ) : null}
                {events && events.results.length > 0 ? (
                  <ul className={cn('border-t border-border', loadingEvents && 'opacity-60')}>
                    {events.results.map((ev) => {
                      const summary = eventSummary(ev);
                      return (
                        <li
                          key={ev.id}
                          className="flex items-center gap-3 border-b border-border px-5 py-2.5 last:border-b-0"
                        >
                          <span
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                            aria-hidden
                          >
                            <KindIcon className="size-[15px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link
                              className={cn(
                                'text-sm font-medium text-foreground underline underline-offset-2 hover:text-primary-ink',
                                isFailureEvent(ev) && 'text-destructive',
                              )}
                              to={eventDetailPath(activityTab, ev.id)}
                            >
                              {ev.label}
                            </Link>
                            {summary ? (
                              <p
                                className="truncate text-xs text-muted-foreground"
                                title={summary}
                              >
                                {summary}
                              </p>
                            ) : null}
                          </div>
                          <time
                            dateTime={ev.created_at}
                            className="whitespace-nowrap text-xs text-muted-foreground"
                          >
                            {formatDateTime(ev.created_at, locale)}
                          </time>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {(!eventsInView && events === null) || (events && eventsTotalPages > 1) ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/60 px-5 py-2.5 text-xs text-muted-foreground">
                    {!eventsInView && events === null ? (
                      <>
                        <span>{t('userDetailEventsDefer')}</span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setEventsInView(true)}
                        >
                          {t('userDetailEventsLoadNow')}
                        </Button>
                      </>
                    ) : events && eventsTotalPages > 1 ? (
                      <TablePager
                        status={t('eventsPageStatus', {
                          page: events.page,
                          pages: eventsTotalPages,
                          total: events.count,
                        })}
                        previousLabel={t('usersPrevPage')}
                        nextLabel={t('usersNextPage')}
                        canPrevious={eventsPage > 1 && !loadingEvents}
                        canNext={eventsPage < eventsTotalPages && !loadingEvents}
                        onPrevious={() => setEventsPage((p) => Math.max(1, p - 1))}
                        onNext={() => setEventsPage((p) => p + 1)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {canDelete ? (
            <DangerCard
              title={t('userDetailDangerZone')}
              description={
                <>
                  <span className="block font-medium text-foreground">
                    {t('userDetailDeleteTitle')}
                  </span>
                  {t('userDetailDeleteHint', { name: displayName(user) })}
                </>
              }
              action={
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={() => void onDeleteUser()}
                  className="inline-flex items-center gap-2"
                >
                  {deleting ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <Trash2
                      className="size-4"
                      aria-hidden
                    />
                  )}
                  {deleting ? t('userDetailDeleting') : t('userDetailDeleteAction')}
                </Button>
              }
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
