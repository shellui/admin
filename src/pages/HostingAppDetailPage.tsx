import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Loader2, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DataTableCard, SkeletonRows } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SettingRow } from '@/components/admin/SettingsSection';
import { StatusBadge, type StatusTone } from '@/components/admin/StatusBadge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { getIsCompanyOwnerFromJwt, getIsStaffFromJwt } from '@/lib/jwtCompany';
import shellui from '@shellui/sdk';
import { confirmAction } from '@/lib/confirmAction';
import { HostingDeployTokensPanel } from '@/components/HostingDeployTokensPanel';

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

function deploymentStatusTone(status: string): StatusTone {
  if (status === 'active') return 'success';
  if (status === 'failed') return 'destructive';
  if (status === 'draft' || status === 'uploading') return 'info';
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
  const canManageTokens = isOwner || Boolean(accessToken && getIsStaffFromJwt(accessToken));
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
    const confirmed = await confirmAction({
      title: t('hostingDeleteTitle'),
      description: t('hostingDeleteConfirm', { name: label }),
      okLabel: t('hostingDelete'),
      cancelLabel: t('hostingDeleteCancel'),
      danger: true,
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

  const back = { to: '/hosting', label: t('hostingBackToApps') };

  if (!hostingBaseUrl) {
    return (
      <div className="w-full space-y-6">
        <PageHeader
          back={back}
          title={name || t('hostingAppsTitle')}
          service="hosting-service"
        />
        <Alert variant="warning">
          <AlertTitle>{t('hostingMissingTitle')}</AlertTitle>
          <AlertDescription>{t('hostingMissingDescription')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!name) {
    return (
      <div className="w-full space-y-6">
        <PageHeader
          back={back}
          title={t('hostingAppsTitle')}
          service="hosting-service"
        />
        <Alert variant="warning">
          <AlertDescription>{t('hostingAppNotFound')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const expired = app ? isPreviewExpired(app.expires_at) : false;
  const cols = [
    'pl-4',
    'hidden md:table-cell',
    '',
    '',
    'hidden md:table-cell',
    'hidden md:table-cell',
    'pr-4',
  ];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        back={back}
        title={app?.display_name || name}
        service="hosting-service"
        description={
          <>
            <span className="block">{t('hostingAppDetailDescription')}</span>
            <span className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
              <span>{name}</span>
              {app?.slug ? <span>{app.slug}</span> : null}
              {app?.urls?.url ? (
                <a
                  href={app.urls.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {app.urls.url}
                  <ExternalLink
                    aria-hidden
                    className="size-3"
                  />
                  <span className="sr-only">{t('navOpensExternally')}</span>
                </a>
              ) : null}
            </span>
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading || deleting}
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
            {app ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={deleting || loading}
                onClick={() => void handleDelete()}
              >
                {deleting ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Trash2 className="mr-1.5 size-3.5" />
                )}
                {t('hostingDelete')}
              </Button>
            ) : null}
          </>
        }
      />

      {!accessToken && (
        <Alert variant="info">
          <AlertDescription>{t('hostingNoSession')}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="font-mono text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {accessToken && !loading && app && appBrowseUrl && redirectStatus === 'missing' ? (
        <Alert variant="warning">
          <AlertTitle>{t('hostingRedirectMissingTitle')}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="font-mono text-xs">
              {t('hostingRedirectMissingDescription', { origin: appOrigin || appBrowseUrl })}
            </p>
            {redirectActionError ? (
              <p className="font-mono text-xs text-destructive">{redirectActionError}</p>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={addingRedirect || !appOrigin}
              onClick={() => void handleAddLoginRedirect()}
            >
              {addingRedirect ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none" />
              ) : null}
              {addingRedirect ? t('hostingRedirectAdding') : t('hostingRedirectAdd')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {accessToken && !loading && app && redirectStatus === 'error' && redirectActionError ? (
        <Alert variant="destructive">
          <AlertDescription className="font-mono text-sm">
            {t('hostingRedirectCheckError')}: {redirectActionError}
          </AlertDescription>
        </Alert>
      ) : null}

      {app && isPreviewApp(app) ? (
        <section className="rounded-xl border border-border bg-card px-4 shadow-sm sm:px-5">
          <SettingRow
            title={`${t('hostingColExpires')}: ${formatDate(app.expires_at ?? null, i18n.language)}`}
            badge={
              expired ? (
                <StatusBadge tone="destructive">{t('hostingExpiresExpired')}</StatusBadge>
              ) : null
            }
            description={expired ? t('hostingExpiresExpiredHint') : t('hostingRenewExpiryHint')}
            control={
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={renewingExpiry || expired}
                      onClick={() => void handleRenewExpiry()}
                    >
                      {renewingExpiry ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none" />
                      ) : (
                        <RotateCcw className="mr-1.5 size-3.5" />
                      )}
                      {t('hostingRenewExpiry')}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {expired ? t('hostingRenewExpiryDisabledHint') : t('hostingRenewExpiryHint')}
                </TooltipContent>
              </Tooltip>
            }
          />
        </section>
      ) : null}

      {accessToken && (loading || app) ? (
        <DataTableCard
          label={t('hostingDeploymentsTitle')}
          busy={loading}
          toolbar={
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{t('hostingDeploymentsTitle')}</h2>
              <p className="text-xs text-muted-foreground">{t('hostingDeploymentsDescription')}</p>
            </div>
          }
        >
          {loading ? <span className="sr-only">{t('hostingAppDetailLoading')}</span> : null}
          {!loading && app && deployments.length === 0 ? (
            <EmptyState
              icon={RotateCcw}
              title={t('hostingDeploymentsEmpty')}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cols[0]}>{t('hostingColVersion')}</TableHead>
                  <TableHead className={cols[1]}>{t('hostingColShellui')}</TableHead>
                  <TableHead>{t('hostingColStatus')}</TableHead>
                  <TableHead>{t('hostingColBrowse')}</TableHead>
                  <TableHead className={cols[4]}>{t('hostingColArtifact')}</TableHead>
                  <TableHead className={cols[5]}>{t('hostingColFinalized')}</TableHead>
                  <TableHead className="pr-4 text-right">{t('hostingColActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonRows
                    rows={3}
                    columns={cols}
                  />
                ) : null}
                {!loading &&
                  app &&
                  deployments.map((deployment) => {
                    const isCurrent = app.current_deployment_id === deployment.id;
                    const showRollback =
                      canRollback(deployment) && deployment.status !== 'active' && !isCurrent;
                    return (
                      <TableRow key={deployment.id}>
                        <TableCell className="pl-4 font-mono text-xs">
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {deployment.app_version}
                            {deployment.pinned ? (
                              <StatusBadge tone="gold">{t('hostingPinned')}</StatusBadge>
                            ) : null}
                            {isCurrent ? (
                              <StatusBadge tone="info">{t('hostingCurrent')}</StatusBadge>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs md:table-cell">
                          {deployment.shellui_version}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            tone={deploymentStatusTone(deployment.status)}
                            dot
                          >
                            {deployment.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {deployment.urls?.url ? (
                            <a
                              href={deployment.urls.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              {t('hostingOpenVersion')}
                              <ExternalLink
                                aria-hidden
                                className="size-3"
                              />
                              <span className="sr-only">{t('navOpensExternally')}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs md:table-cell">
                          {formatBytes(deployment.artifact_size)}
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                          {formatDate(deployment.finalized_at, i18n.language)}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          {showRollback ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={rollingBackId != null}
                              onClick={() => void handleRollback(deployment.id)}
                            >
                              {rollingBackId === deployment.id ? (
                                <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none" />
                              ) : (
                                <RotateCcw className="mr-1.5 size-3.5" />
                              )}
                              {t('hostingRollback')}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </DataTableCard>
      ) : null}

      {accessToken && app && !isPreviewApp(app) && canManageTokens ? (
        <HostingDeployTokensPanel
          hostingBaseUrl={hostingBaseUrl}
          accessToken={accessToken}
          appRef={app.name}
        />
      ) : null}
    </div>
  );
}
