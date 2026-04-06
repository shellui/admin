import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import shellui from "@shellui/sdk";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useShelluiAccessToken } from "@/hooks/useShelluiAccessToken";
import {
  fetchAdminLoginEvents,
  fetchAdminUser,
  updateAdminUser,
  type AdminLoginEventListResponse,
  type AdminUserRow,
  type ShellUIPreferencesPayload,
} from "@/lib/adminUsersApi";
import { fetchAdminGroups, type AdminGroupRow } from "@/lib/adminGroupsApi";
import { cn } from "@/lib/utils";

/** Matches server default cap; keep moderate to limit JSON payload per request. */
const LOGIN_EVENTS_PAGE_SIZE = 15;

function parsePreferences(
  meta: Record<string, unknown>,
): ShellUIPreferencesPayload | null {
  const raw = meta.shelluiPreferences;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    themeName: typeof o.themeName === "string" ? o.themeName : null,
    language: typeof o.language === "string" ? o.language : null,
    region: typeof o.region === "string" ? o.region : null,
    colorScheme: typeof o.colorScheme === "string" ? o.colorScheme : null,
  };
}

function avatarUrlFromUser(user: AdminUserRow): string | null {
  const u = user.user_metadata.avatar_url;
  return typeof u === "string" && u.trim() ? u.trim() : null;
}

function lastSeenFromUser(user: AdminUserRow): string | null {
  const v = user.user_metadata.last_seen_at;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function displayName(user: AdminUserRow): string {
  const meta = user.user_metadata;
  if (typeof meta.full_name === "string" && meta.full_name.trim())
    return meta.full_name.trim();
  const combined = `${user.first_name} ${user.last_name}`.trim();
  return combined || user.username || user.email || "—";
}

function formatDateTime(iso: string | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function UserDetailPage() {
  const { t, i18n } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const accessToken = useShelluiAccessToken();
  const idNum = userId ? parseInt(userId, 10) : NaN;

  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [events, setEvents] = useState<AdminLoginEventListResponse | null>(
    null,
  );
  const [eventsPage, setEventsPage] = useState(1);
  const [loginHistoryInView, setLoginHistoryInView] = useState(false);
  const loginHistorySectionRef = useRef<HTMLDivElement>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [allGroups, setAllGroups] = useState<AdminGroupRow[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      setLoadError(e instanceof Error ? e.message : t("usersErrorUnknown"));
    } finally {
      setLoadingUser(false);
    }
  }, [accessToken, idNum, t]);

  const loadEvents = useCallback(async () => {
    if (!loginHistoryInView || !accessToken || !Number.isFinite(idNum)) {
      return;
    }
    setLoadingEvents(true);
    setEventsError(null);
    try {
      const ev = await fetchAdminLoginEvents(accessToken, {
        user_id: idNum,
        page: eventsPage,
        pageSize: LOGIN_EVENTS_PAGE_SIZE,
      });
      setEvents(ev);
    } catch (e) {
      setEvents(null);
      setEventsError(e instanceof Error ? e.message : t("usersErrorUnknown"));
    } finally {
      setLoadingEvents(false);
    }
  }, [loginHistoryInView, accessToken, idNum, eventsPage, t]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    setEventsPage(1);
    setEvents(null);
    setEventsError(null);
    setLoginHistoryInView(false);
    setLoadingEvents(false);
  }, [idNum]);

  useEffect(() => {
    const el = loginHistorySectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoginHistoryInView(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin: "160px 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [idNum]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const preferences = useMemo(
    () => (user ? parsePreferences(user.user_metadata) : null),
    [user],
  );

  const eventsTotalPages = useMemo(() => {
    if (!events?.count) return 1;
    const ps = events.page_size > 0 ? events.page_size : LOGIN_EVENTS_PAGE_SIZE;
    return Math.max(1, Math.ceil(events.count / ps));
  }, [events?.count, events?.page_size]);

  if (!Number.isFinite(idNum)) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{t("userDetailInvalidId")}</p>
      </div>
    );
  }

  const locale = i18n.language || "en";

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
      shellui.toast({ title: t("userDetailSaved"), type: "success" });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("usersErrorUnknown"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => navigate(-1)}
        >
          {t("userDetailBack")}
        </Button>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {t("userDetailTitle")}
        </h1>
      </header>

      {!accessToken ? (
        <Text className="text-sm text-muted-foreground">
          {t("usersNoSession")}
        </Text>
      ) : loadError && !user ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      ) : loadingUser && !user ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-sm">{t("userDetailLoading")}</span>
        </div>
      ) : user ? (
        <>
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-row flex-wrap items-start gap-4 space-y-0">
              <div className="shrink-0">
                {avatarUrlFromUser(user) ? (
                  <img
                    src={avatarUrlFromUser(user)!}
                    alt=""
                    className="size-20 rounded-full border border-border object-cover md:size-24"
                  />
                ) : (
                  <div
                    className="flex size-20 items-center justify-center rounded-full border border-dashed border-border bg-muted text-lg font-medium text-muted-foreground md:size-24"
                    aria-hidden
                  >
                    {displayName(user).slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <CardTitle className="text-xl leading-tight">
                  {displayName(user)}
                </CardTitle>
                <CardDescription className="font-mono text-sm">
                  {user.email}
                </CardDescription>
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("usersColStaff")}
                    </span>
                    <Badge
                      variant={user.is_staff ? "default" : "outline"}
                      className="tabular-nums"
                    >
                      {user.is_staff ? t("usersStaffYes") : t("usersStaffNo")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("usersColActive")}
                    </span>
                    <Badge
                      variant={user.is_active ? "secondary" : "muted"}
                      className="tabular-nums"
                    >
                      {user.is_active ? t("usersActiveYes") : t("usersActiveNo")}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 border-t border-border/80 pt-6">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("userDetailUsername")}
                  </dt>
                  <dd className="mt-0.5 font-mono">{user.username}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("userDetailId")}
                  </dt>
                  <dd className="mt-0.5 tabular-nums">{user.id}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("userDetailFirstName")}
                  </dt>
                  <dd className="mt-0.5">{user.first_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("userDetailLastName")}
                  </dt>
                  <dd className="mt-0.5">{user.last_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("userDetailLastSeen")}
                  </dt>
                  <dd className="mt-0.5">
                    {formatDateTime(
                      lastSeenFromUser(user) ?? undefined,
                      locale,
                    )}
                  </dd>
                </div>
              </dl>
              <div className="space-y-4 border-t border-border/80 pt-6">
                <div>
                  <h3 className="text-sm font-medium leading-none">
                    {t("userDetailMembershipTitle")}
                  </h3>
                  <p className="pt-1.5 text-xs text-muted-foreground">
                    {t("userDetailMembershipHint")}
                  </p>
                </div>
                {saveError ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {saveError}
                  </p>
                ) : null}
                <div className="space-y-2 rounded-md border p-3">
                  <Label>{t("userDetailGroups")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("userDetailGroupsEditableHint")}
                  </p>
                  {allGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("userDetailGroupsEmpty")}
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-48 space-y-2 overflow-auto pr-1">
                      {allGroups.map((g) => {
                        const checked = selectedGroupIds.includes(g.id);
                        return (
                          <li key={g.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`user-detail-group-${g.id}`}
                              className="size-4 rounded border"
                              checked={checked}
                              onChange={() => {
                                setSelectedGroupIds((prev) =>
                                  checked
                                    ? prev.filter((id) => id !== g.id)
                                    : [...prev, g.id],
                                );
                              }}
                            />
                            <label
                              htmlFor={`user-detail-group-${g.id}`}
                              className="cursor-pointer text-sm"
                            >
                              {g.name}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void onSaveMembership()}
                  className="inline-flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("userDetailSaving")}
                    </>
                  ) : (
                    t("userDetailSave")
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">
                {t("userDetailPreferencesTitle")}
              </CardTitle>
              <CardDescription>
                {t("userDetailPreferencesHint")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!preferences ? (
                <p className="text-sm text-muted-foreground">
                  {t("userDetailPreferencesEmpty")}
                </p>
              ) : (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("userDetailPrefTheme")}
                    </dt>
                    <dd className="mt-0.5">{preferences.themeName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("userDetailPrefLanguage")}
                    </dt>
                    <dd className="mt-0.5">{preferences.language ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("userDetailPrefRegion")}
                    </dt>
                    <dd className="mt-0.5">{preferences.region ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("userDetailPrefColorScheme")}
                    </dt>
                    <dd className="mt-0.5">{preferences.colorScheme ?? "—"}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>

          <div ref={loginHistorySectionRef}>
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("userDetailLoginHistoryTitle")}
                </CardTitle>
                <CardDescription>
                  {t("userDetailLoginHistoryHint")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!loginHistoryInView && events === null ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <p className="max-w-xl text-sm text-muted-foreground">
                      {t("userDetailLoginHistoryDefer")}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setLoginHistoryInView(true)}
                    >
                      {t("userDetailLoginHistoryLoadNow")}
                    </Button>
                  </div>
                ) : null}
                {eventsError ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {eventsError}
                  </p>
                ) : null}
                {loginHistoryInView && loadingEvents && !events ? (
                  <div className="flex items-center gap-2 py-6 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    <span className="text-sm">
                      {t("userDetailLoginHistoryLoading")}
                    </span>
                  </div>
                ) : null}
                {events && events.results.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("userDetailLoginHistoryEmpty")}
                  </p>
                ) : null}
                {events && events.results.length > 0 ? (
                  <>
                    <div
                      className={cn(
                        "relative rounded-md border border-border",
                        loadingEvents && "opacity-60",
                      )}
                    >
                      {loadingEvents ? (
                        <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-background/40">
                          <Loader2
                            className="size-6 animate-spin text-muted-foreground"
                            aria-hidden
                          />
                          <span className="sr-only">
                            {t("userDetailLoginHistoryLoading")}
                          </span>
                        </div>
                      ) : null}
                      <div className="w-full overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableHead className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t("userDetailLoginColWhen")}
                              </TableHead>
                              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t("userDetailLoginColProvider")}
                              </TableHead>
                              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t("userDetailLoginColOutcome")}
                              </TableHead>
                              <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t("userDetailLoginColStaff")}
                              </TableHead>
                              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t("userDetailLoginColCountry")}
                              </TableHead>
                              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t("userDetailLoginColTimezone")}
                              </TableHead>
                              <TableHead className="hidden xl:table-cell min-w-[12rem] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t("userDetailLoginColUserAgent")}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="font-mono text-xs">
                            {events.results.map((ev) => (
                              <TableRow key={ev.id}>
                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                  <Link
                                    className="text-primary underline-offset-2 hover:underline"
                                    to={`/login-events/${ev.id}`}
                                  >
                                    {formatDateTime(ev.created_at, locale)}
                                  </Link>
                                </TableCell>
                                <TableCell>{ev.provider}</TableCell>
                                <TableCell>
                                  <span
                                    className={cn(
                                      "rounded px-1.5 py-0.5",
                                      ev.outcome === "success"
                                        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                                        : "bg-destructive/15 text-destructive",
                                    )}
                                  >
                                    {ev.outcome}
                                  </span>
                                  {ev.failure_reason ? (
                                    <span
                                      className="mt-1 block max-w-[14rem] truncate text-[10px] text-muted-foreground"
                                      title={ev.failure_reason}
                                    >
                                      {ev.failure_reason}
                                    </span>
                                  ) : null}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {ev.is_staff_at_event
                                    ? t("usersStaffYes")
                                    : t("usersStaffNo")}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {ev.client_country || "—"}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell font-mono text-[10px]">
                                  {ev.client_timezone || "—"}
                                </TableCell>
                                <TableCell
                                  className="hidden xl:table-cell max-w-[20rem] truncate text-[10px]"
                                  title={ev.user_agent}
                                >
                                  {ev.user_agent || "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    {eventsTotalPages > 1 ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          {t("userDetailLoginPagination", {
                            page: events.page,
                            pages: eventsTotalPages,
                            total: events.count,
                          })}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={eventsPage <= 1 || loadingEvents}
                            onClick={() =>
                              setEventsPage((p) => Math.max(1, p - 1))
                            }
                          >
                            {t("usersPrevPage")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              eventsPage >= eventsTotalPages || loadingEvents
                            }
                            onClick={() => setEventsPage((p) => p + 1)}
                          >
                            {t("usersNextPage")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
