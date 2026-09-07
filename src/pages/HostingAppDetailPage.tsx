import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
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
  createOAuthRedirect,
  fetchOAuthRedirects,
  oauthRedirectCoversOrigin,
  originFromUrl,
} from '@/lib/adminOauthRedirectsApi';
import {
  deleteHostingApp,
  fetchHostingApp,
  fetchHostingDeployments,
  renewHostingAppExpiry,
  rollbackHostingDeployment,
  useHostingBaseUrl,
  type HostingApp,
  type HostingDeployment,
} from '@/lib/hostingApi';
import { getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
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

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function deploymentStatusVariant(status: string): 'default' | 'secondary' | 'outline' | 'muted' {
  if (status === 'active') return 'default';
  if (status === 'failed') return 'outline';
  if (status === 'draft' || status === 'uploading') return 'secondary';
  return 'muted';
}

function canRollback(deployment: HostingDeployment): boolean {
  return (
    deployment.status === 'ready' ||
    deployment.status === 'superseded' ||
    (deployment.status === 'active' && deployment.artifact_size > 0)
  );
}

export function HostingAppDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { name = '' } = useParams<{ name: string }>();
  const accessToken = useShelluiAccessToken();
  const hostingBaseUrl = useHostingBaseUrl();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const [app, setApp] = useState<HostingApp | null>(null);
  const [deployments, setDeployments] = useState<HostingDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [renewingExpiry, setRenewingExpiry] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectStatus, setRedirectStatus] = useState<
    'idle' | 'loading' | 'ok' | 'missing' | 'forbidden' | 'error'
  >('idle');
  const [addingRedirect, setAddingRedirect] = useState(false);
  const [redirectActionError, setRedirectActionError] = useState<string | null>(null);

  const appBrowseUrl = app?.urls?.url?.trim() || '';
  const appOrigin = useMemo(() => originFromUrl(appBrowseUrl), [appBrowseUrl]);

  const checkRedirectAllowlist = useCallback(
    async (browseUrl: string) => {
      if (!accessToken || !isOwner || !browseUrl) {
        setRedirectStatus('idle');
        setRedirectActionError(null);
        return;
      }
      setRedirectStatus('loading');
      setRedirectActionError(null);
      try {
        const rows = await fetchOAuthRedirects(accessToken);
        setRedirectStatus(oauthRedirectCoversOrigin(rows, browseUrl) ? 'ok' : 'missing');
      } catch (e) {
        const message = e instanceof Error ? e.message : '';
        if (/403|forbidden|owner/i.test(message)) {
          setRedirectStatus('forbidden');
        } else {
          setRedirectStatus('error');
          setRedirectActionError(message || t('hostingRedirectCheckError'));
        }
      }
    },
    [accessToken, isOwner, t],
  );

  const load = useCallback(async () => {
    if (!accessToken || !hostingBaseUrl || !name) {
      setLoading(false);
      setApp(null);
      setDeployments([]);
      setError(null);
      setRedirectStatus('idle');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [appResult, deploymentsResult] = await Promise.all([
        fetchHostingApp(hostingBaseUrl, accessToken, name),
        fetchHostingDeployments(hostingBaseUrl, accessToken, name),
      ]);
      setApp(appResult);
      setDeployments(deploymentsResult);
      const browseUrl = appResult.urls?.url?.trim() || '';
      if (browseUrl) {
        void checkRedirectAllowlist(browseUrl);
      } else {
        setRedirectStatus('idle');
      }
    } catch (e) {
      setApp(null);
      setDeployments([]);
      setRedirectStatus('idle');
      setError(e instanceof Error ? e.message : t('hostingAppDetailError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, checkRedirectAllowlist, hostingBaseUrl, name, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAddLoginRedirect() {
    if (!accessToken || !appOrigin || addingRedirect || redirectStatus !== 'missing') return;
    setAddingRedirect(true);
    setRedirectActionError(null);
    try {
      await createOAuthRedirect(accessToken, {
        base_url: appOrigin,
        label: app?.display_name || app?.slug || name,
        source: 'hosting',
      });
      setRedirectStatus('ok');
      shellui.toast({ title: t('hostingRedirectAdded'), type: 'success' });
    } catch (e) {
      setRedirectActionError(e instanceof Error ? e.message : t('hostingRedirectAddError'));
    } finally {
      setAddingRedirect(false);
    }
  }

  async function handleRollback(deploymentId: string) {
    if (!accessToken || !hostingBaseUrl || !name || rollingBackId) return;
    setRollingBackId(deploymentId);
    setError(null);
    try {
      await rollbackHostingDeployment(hostingBaseUrl, accessToken, name, deploymentId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('hostingRollbackError'));
    } finally {
      setRollingBackId(null);
    }
  }

  async function handleRenewExpiry() {
    if (
      !accessToken ||
      !hostingBaseUrl ||
      !name ||
      renewingExpiry ||
      isPreviewExpired(app?.expires_at)
    ) {
      return;
    }
    setRenewingExpiry(true);
    setError(null);
    try {
      setApp(await renewHostingAppExpiry(hostingBaseUrl, accessToken, name));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('hostingRenewExpiryError'));
    } finally {
      setRenewingExpiry(false);
    }
  }

  async function handleDelete() {
    if (!accessToken || !hostingBaseUrl || !name || deleting || !app) return;
    const label = app.display_name || app.name;
    const confirmed =
      typeof window === 'undefined' || window.parent === window
        ? window.confirm(t('hostingDeleteConfirm', { name: label }))
        : await new Promise<boolean>((resolve) => {
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
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteHostingApp(hostingBaseUrl, accessToken, name);
      shellui.toast({ title: t('hostingDeleted'), type: 'success' });
      navigate('/hosting');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('hostingDeleteError'));
      setDeleting(false);
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

  if (!name) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-8 md:px-6">
        <Text className="text-sm text-muted-foreground">{t('hostingAppNotFound')}</Text>
        <Link
          to="/hosting"
          className="text-sm text-primary hover:underline"
        >
          {t('hostingBackToApps')}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      <header className="space-y-4">
        <Link
          to="/hosting"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t('hostingBackToApps')}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
                {app?.display_name || name}
              </h1>
              <Badge
                variant="secondary"
                className="font-mono text-[10px] uppercase"
              >
                {name}
              </Badge>
              {app?.slug ? (
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] uppercase"
                >
                  {app.slug}
                </Badge>
              ) : null}
            </div>
            <Text className="font-mono text-sm text-muted-foreground">
              {t('hostingAppDetailDescription')}
            </Text>
            {app?.urls?.url ? (
              <a
                href={app.urls.url}
                target="_blank"
                rel="noreferrer"
                className="inline-block font-mono text-sm text-primary hover:underline"
              >
                {app.urls.url}
              </a>
            ) : null}
            {app && isPreviewApp(app) ? (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Text className="font-mono text-sm text-muted-foreground">
                    {t('hostingColExpires')}: {formatDate(app.expires_at ?? null, i18n.language)}
                  </Text>
                  {isPreviewExpired(app.expires_at) ? (
                    <Badge variant="outline">{t('hostingExpiresExpired')}</Badge>
                  ) : null}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={renewingExpiry || isPreviewExpired(app.expires_at)}
                          onClick={() => void handleRenewExpiry()}
                        >
                          {renewingExpiry ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-1.5 size-3.5" />
                          )}
                          {t('hostingRenewExpiry')}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {isPreviewExpired(app.expires_at)
                        ? t('hostingRenewExpiryDisabledHint')
                        : t('hostingRenewExpiryHint')}
                    </TooltipContent>
                  </Tooltip>
                </div>
                {isPreviewExpired(app.expires_at) ? (
                  <Text className="text-sm text-muted-foreground">
                    {t('hostingExpiresExpiredHint')}
                  </Text>
                ) : (
                  <Text className="text-sm text-muted-foreground">
                    {t('hostingRenewExpiryHint')}
                  </Text>
                )}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {app ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={deleting || loading}
                onClick={() => void handleDelete()}
              >
                {deleting ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 size-3.5" />
                )}
                {t('hostingDelete')}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
              disabled={loading || deleting}
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              {t('hostingRefresh')}
            </button>
          </div>
        </div>
      </header>

      {!accessToken && (
        <Text className="font-mono text-sm text-muted-foreground">{t('hostingNoSession')}</Text>
      )}

      {accessToken && loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('hostingAppDetailLoading')}
        </div>
      )}

      {error && <Text className="font-mono text-sm text-destructive">{error}</Text>}

      {accessToken && !loading && app && appBrowseUrl && redirectStatus === 'missing' ? (
        <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 space-y-1">
              <Text className="text-sm font-medium text-destructive">
                {t('hostingRedirectMissingTitle')}
              </Text>
              <Text className="font-mono text-xs text-destructive/90">
                {t('hostingRedirectMissingDescription', { origin: appOrigin || appBrowseUrl })}
              </Text>
              {redirectActionError ? (
                <Text className="font-mono text-xs text-destructive">{redirectActionError}</Text>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="shrink-0"
            disabled={addingRedirect || !appOrigin}
            onClick={() => void handleAddLoginRedirect()}
          >
            {addingRedirect ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            {addingRedirect ? t('hostingRedirectAdding') : t('hostingRedirectAdd')}
          </Button>
        </div>
      ) : null}

      {accessToken && !loading && app && redirectStatus === 'error' && redirectActionError ? (
        <Text className="font-mono text-sm text-muted-foreground">
          {t('hostingRedirectCheckError')}: {redirectActionError}
        </Text>
      ) : null}

      {accessToken && !loading && app && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t('hostingDeploymentsTitle')}</CardTitle>
            <CardDescription>{t('hostingDeploymentsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {deployments.length === 0 ? (
              <Text className="text-sm text-muted-foreground">{t('hostingDeploymentsEmpty')}</Text>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('hostingColVersion')}</TableHead>
                    <TableHead>{t('hostingColShellui')}</TableHead>
                    <TableHead>{t('hostingColStatus')}</TableHead>
                    <TableHead>{t('hostingColBrowse')}</TableHead>
                    <TableHead>{t('hostingColArtifact')}</TableHead>
                    <TableHead>{t('hostingColFinalized')}</TableHead>
                    <TableHead className="text-right">{t('hostingColActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployments.map((deployment) => {
                    const isCurrent = app.current_deployment_id === deployment.id;
                    const showRollback =
                      canRollback(deployment) && deployment.status !== 'active' && !isCurrent;
                    return (
                      <TableRow key={deployment.id}>
                        <TableCell className="font-mono text-xs">
                          {deployment.app_version}
                          {deployment.pinned ? (
                            <Badge
                              variant="outline"
                              className="ml-2 text-[10px]"
                            >
                              {t('hostingPinned')}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {deployment.shellui_version}
                        </TableCell>
                        <TableCell>
                          <Badge variant={deploymentStatusVariant(deployment.status)}>
                            {deployment.status}
                          </Badge>
                          {isCurrent ? (
                            <Badge
                              variant="secondary"
                              className="ml-2 text-[10px]"
                            >
                              {t('hostingCurrent')}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {deployment.urls?.url ? (
                            <a
                              href={deployment.urls.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              {t('hostingOpenVersion')}
                            </a>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {formatBytes(deployment.artifact_size)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {formatDate(deployment.finalized_at, i18n.language)}
                        </TableCell>
                        <TableCell className="text-right">
                          {showRollback ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={rollingBackId != null}
                              onClick={() => void handleRollback(deployment.id)}
                            >
                              {rollingBackId === deployment.id ? (
                                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="mr-1.5 size-3.5" />
                              )}
                              {t('hostingRollback')}
                            </Button>
                          ) : (
                            <Text className="text-xs text-muted-foreground">—</Text>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
