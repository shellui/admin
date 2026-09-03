import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AppWindow, Clock, Loader2, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

function formatDate(value: string | null, locale: string): string {
  if (!value) return '—';
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

  const variant =
    access.status === 'denied' ? 'outline' : access.status === 'pending' ? 'secondary' : 'muted';

  return (
    <Card className="border-border/80 bg-muted/30 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('hostingWaitlistTitle')}</CardTitle>
        <CardDescription>{t('hostingWaitlistDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Badge variant={variant}>{t(`hostingAccessStatus_${access.status}`)}</Badge>
        {access.status === 'none' ? (
          <Button
            type="button"
            size="sm"
            disabled={requesting}
            onClick={onRequest}
          >
            {requesting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t('hostingWaitlistRequest')}
          </Button>
        ) : null}
        {access.status === 'pending' ? (
          <Text className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            {t('hostingWaitlistPendingHint')}
          </Text>
        ) : null}
        {access.status === 'denied' && access.notes ? (
          <Text className="text-sm text-muted-foreground">{access.notes}</Text>
        ) : null}
      </CardContent>
    </Card>
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
    if (typeof window === 'undefined' || window.parent === window) {
      return window.confirm(t('hostingDeleteConfirm', { name: label }));
    }
    return await new Promise<boolean>((resolve) => {
      shellui.dialog({
        title: t('hostingDeleteTitle'),
        description: t('hostingDeleteConfirm', { name: label }),
        mode: 'confirm',
        okLabel: t('hostingDelete'),
        cancelLabel: t('hostingDeleteCancel'),
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
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
      <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-8 md:px-6">
        <h1 className="text-xl font-semibold tracking-tight">{t('hostingMissingTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('hostingMissingDescription')}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              {t('hostingAppsTitle')}
            </h1>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] uppercase"
            >
              {t('hostingAppsBadge')}
            </Badge>
          </div>
          <Text className="max-w-3xl font-mono text-sm">{t('hostingAppsDescription')}</Text>
          <Text className="font-mono text-xs text-muted-foreground">{hostingBaseUrl}</Text>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          disabled={loading}
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('hostingRefresh')}
        </button>
      </header>

      {!accessToken && (
        <Text className="font-mono text-sm text-muted-foreground">{t('hostingNoSession')}</Text>
      )}

      {access ? (
        <WaitlistBanner
          access={access}
          requesting={requesting}
          onRequest={() => void handleRequestAccess()}
        />
      ) : null}

      {accessToken && loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('hostingAppsLoading')}
        </div>
      )}

      {error && <Text className="font-mono text-sm text-destructive">{error}</Text>}

      {accessToken && !loading && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AppWindow className="size-4" />
              {t('hostingAppsListTitle')}
            </CardTitle>
            <CardDescription>{t('hostingAppsListDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {apps.length === 0 ? (
              <Text className="text-sm text-muted-foreground">{t('hostingAppsEmpty')}</Text>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('hostingColApp')}</TableHead>
                    <TableHead>{t('hostingColSlug')}</TableHead>
                    <TableHead>{t('hostingColExpires')}</TableHead>
                    <TableHead>{t('hostingColUpdated')}</TableHead>
                    <TableHead className="text-right">{t('hostingColActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <Link
                          to={`/hosting/apps/${app.name}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {app.display_name || app.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {app.urls?.url ? (
                          <a
                            href={app.urls.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {app.slug}
                          </a>
                        ) : (
                          app.slug
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {isPreviewApp(app) ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{formatDate(app.expires_at ?? null, i18n.language)}</span>
                              {isPreviewExpired(app.expires_at) ? (
                                <Badge variant="outline">{t('hostingExpiresExpired')}</Badge>
                              ) : null}
                            </div>
                            {isPreviewExpired(app.expires_at) ? (
                              <Text className="text-xs text-muted-foreground">
                                {t('hostingExpiresExpiredHint')}
                              </Text>
                            ) : null}
                          </div>
                        ) : (
                          <Text className="text-muted-foreground">{t('hostingExpiresNever')}</Text>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDate(app.updated_at, i18n.language)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
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
                              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
