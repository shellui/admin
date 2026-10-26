import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  AppWindow,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DataTableCard, SkeletonRows } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import {
  deleteHostingApp,
  fetchHostingAccess,
  fetchHostingApps,
  renewHostingAppExpiry,
  requestHostingAccess,
  useHostingBaseUrl,
  type HostingAccess,
  type HostingApp,
} from '@/lib/hostingApi';
import shellui from '@shellui/sdk';
import { confirmAction } from '@/lib/confirmAction';

function formatDate(value: string | null, locale: string): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString(locale);
  } catch {
    return value;
  }
}

function isPreviewExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

function isPreviewApp(app: HostingApp): boolean {
  return app.expires_at != null;
}

function PreviewRenewButton({
  app,
  renewingId,
  onRenew,
}: {
  app: HostingApp;
  renewingId: string | null;
  onRenew: () => void;
}) {
  const { t } = useTranslation();
  const expired = isPreviewExpired(app.expires_at);
  const renewing = renewingId === app.id;

  const button = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={expired || renewingId != null}
      onClick={() => void onRenew()}
    >
      {renewing ? (
        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
      ) : (
        <RotateCcw className="mr-1.5 size-3.5" />
      )}
      {t('hostingRenewExpiry')}
    </Button>
  );

  if (expired) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{button}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{t('hostingRenewExpiryDisabledHint')}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{t('hostingRenewExpiryHint')}</TooltipContent>
    </Tooltip>
  );
}

function WaitlistBanner({
  access,
  requesting,
  onRequest,
}: {
  access: HostingAccess;
  requesting: boolean;
  onRequest: () => void;
}) {
  const { t } = useTranslation();

  if (access.status === 'approved') return null;

  const tone =
    access.status === 'denied' ? 'destructive' : access.status === 'pending' ? 'warning' : 'muted';

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{t('hostingWaitlistTitle')}</h2>
        <StatusBadge
          tone={tone}
          dot
        >
          {t(`hostingAccessStatus_${access.status}`)}
        </StatusBadge>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">{t('hostingWaitlistDescription')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {access.status === 'none' ? (
          <Button
            type="button"
            size="sm"
            disabled={requesting}
            onClick={onRequest}
          >
            {requesting ? (
              <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />
            ) : null}
            {t('hostingWaitlistRequest')}
          </Button>
        ) : null}
        {access.status === 'pending' ? (
          <Text className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock
              aria-hidden
              className="size-3.5"
            />
            {t('hostingWaitlistPendingHint')}
          </Text>
        ) : null}
      </div>
      {access.status === 'denied' && access.notes ? (
        <Alert
          variant="destructive"
          className="mt-3"
        >
          <AlertDescription>{access.notes}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}

export function HostingAppsPage() {
  const { t, i18n } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const hostingBaseUrl = useHostingBaseUrl();
  const [apps, setApps] = useState<HostingApp[]>([]);
  const [access, setAccess] = useState<HostingAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !hostingBaseUrl) {
      setLoading(false);
      setApps([]);
      setAccess(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [accessResult, appsResult] = await Promise.all([
        fetchHostingAccess(hostingBaseUrl, accessToken),
        fetchHostingApps(hostingBaseUrl, accessToken),
      ]);
      setAccess(accessResult);
      setApps(appsResult);
    } catch (e) {
      setApps([]);
      setAccess(null);
      setError(e instanceof Error ? e.message : t('hostingAppsError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, hostingBaseUrl, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRequestAccess() {
    if (!accessToken || !hostingBaseUrl || requesting) return;
    setRequesting(true);
    setError(null);
    try {
      setAccess(await requestHostingAccess(hostingBaseUrl, accessToken));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('hostingWaitlistRequestError'));
    } finally {
      setRequesting(false);
    }
  }

  async function handleRenewExpiry(app: HostingApp) {
    if (!accessToken || !hostingBaseUrl || renewingId || isPreviewExpired(app.expires_at)) return;
    setRenewingId(app.id);
    setError(null);
    try {
      const updated = await renewHostingAppExpiry(hostingBaseUrl, accessToken, app.name);
      setApps((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('hostingRenewExpiryError'));
    } finally {
      setRenewingId(null);
    }
  }

  async function confirmDeleteApp(app: HostingApp): Promise<boolean> {
    const label = app.display_name || app.name;
    return confirmAction({
      title: t('hostingDeleteTitle'),
      description: t('hostingDeleteConfirm', { name: label }),
      okLabel: t('hostingDelete'),
      cancelLabel: t('hostingDeleteCancel'),
      danger: true,
    });
  }

  async function handleDelete(app: HostingApp) {
    if (!accessToken || !hostingBaseUrl || deletingId) return;
    const confirmed = await confirmDeleteApp(app);
    if (!confirmed) return;
    setDeletingId(app.id);
    setError(null);
    try {
      await deleteHostingApp(hostingBaseUrl, accessToken, app.name);
      setApps((prev) => prev.filter((row) => row.id !== app.id));
      shellui.toast({ title: t('hostingDeleted'), type: 'success' });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('hostingDeleteError'));
    } finally {
      setDeletingId(null);
    }
  }

  if (!hostingBaseUrl) {
    return (
      <div className="w-full space-y-6">
        <PageHeader
          title={t('hostingAppsTitle')}
          service={t('hostingAppsBadge')}
        />
        <Alert variant="warning">
          <AlertTitle>{t('hostingMissingTitle')}</AlertTitle>
          <AlertDescription>{t('hostingMissingDescription')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const cols = ['pl-4', 'hidden md:table-cell', '', 'hidden md:table-cell', 'pr-4'];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('hostingAppsTitle')}
        service={t('hostingAppsBadge')}
        description={
          <>
            <span className="block">{t('hostingAppsDescription')}</span>
            <span className="mt-1 block font-mono text-xs text-muted-foreground">
              {hostingBaseUrl}
            </span>
          </>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              aria-hidden
              className={cn(
                'mr-1.5 size-3.5',
                loading && 'animate-spin motion-reduce:animate-none',
              )}
            />
            {t('hostingRefresh')}
          </Button>
        }
      />

      {!accessToken && (
        <Alert variant="info">
          <AlertDescription>{t('hostingNoSession')}</AlertDescription>
        </Alert>
      )}

      {access ? (
        <WaitlistBanner
          access={access}
          requesting={requesting}
          onRequest={() => void handleRequestAccess()}
        />
      ) : null}

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="font-mono text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {accessToken && (
        <DataTableCard
          label={t('hostingAppsListTitle')}
          busy={loading}
          toolbar={
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{t('hostingAppsListTitle')}</h2>
              <p className="text-xs text-muted-foreground">{t('hostingAppsListDescription')}</p>
            </div>
          }
        >
          {loading ? <span className="sr-only">{t('hostingAppsLoading')}</span> : null}
          {!loading && apps.length === 0 ? (
            <EmptyState
              icon={AppWindow}
              title={t('hostingAppsEmpty')}
            />
          ) : (
            <TooltipProvider delayDuration={200}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={cols[0]}>{t('hostingColApp')}</TableHead>
                    <TableHead className={cols[1]}>{t('hostingColSlug')}</TableHead>
                    <TableHead>{t('hostingColExpires')}</TableHead>
                    <TableHead className={cols[3]}>{t('hostingColUpdated')}</TableHead>
                    <TableHead className="pr-4 text-right">{t('hostingColActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <SkeletonRows
                      rows={4}
                      columns={cols}
                    />
                  ) : null}
                  {!loading &&
                    apps.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="pl-4">
                          <Link
                            to={`/hosting/apps/${app.name}`}
                            className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span
                              aria-hidden
                              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
                            >
                              <AppWindow className="size-4" />
                            </span>
                            <span className="truncate font-medium text-foreground hover:underline">
                              {app.display_name || app.name}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs md:table-cell">
                          {app.urls?.url ? (
                            <a
                              href={app.urls.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 whitespace-nowrap text-primary hover:underline"
                            >
                              {app.slug}
                              <ExternalLink
                                aria-hidden
                                className="size-3"
                              />
                              <span className="sr-only">{t('navOpensExternally')}</span>
                            </a>
                          ) : (
                            app.slug
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isPreviewApp(app) ? (
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2 font-mono">
                                <span>{formatDate(app.expires_at ?? null, i18n.language)}</span>
                                {isPreviewExpired(app.expires_at) ? (
                                  <StatusBadge tone="destructive">
                                    {t('hostingExpiresExpired')}
                                  </StatusBadge>
                                ) : null}
                              </div>
                              {isPreviewExpired(app.expires_at) ? (
                                <Text className="text-xs text-muted-foreground">
                                  {t('hostingExpiresExpiredHint')}
                                </Text>
                              ) : null}
                            </div>
                          ) : (
                            <StatusBadge tone="muted">{t('hostingExpiresNever')}</StatusBadge>
                          )}
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                          {formatDate(app.updated_at, i18n.language)}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {isPreviewApp(app) ? (
                              <PreviewRenewButton
                                app={app}
                                renewingId={renewingId}
                                onRenew={() => void handleRenewExpiry(app)}
                              />
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={deletingId != null || renewingId != null}
                              onClick={() => void handleDelete(app)}
                            >
                              {deletingId === app.id ? (
                                <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none" />
                              ) : (
                                <Trash2 className="mr-1.5 size-3.5" />
                              )}
                              {t('hostingDelete')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </DataTableCard>
      )}
    </div>
  );
}
