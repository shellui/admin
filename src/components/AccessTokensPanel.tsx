import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, KeyRound, Loader2 } from 'lucide-react';
import { DataTableCard, SkeletonRows } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import shellui from '@shellui/sdk';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createPersonalAccessToken,
  fetchPersonalAccessTokens,
  revokePersonalAccessToken,
  type AdminPersonalAccessTokenRow,
} from '@/lib/accessTokensApi';
import { getIsStaffFromJwt, getUserIdFromJwt } from '@/lib/jwtCompany';

function formatDateTime(iso: string | undefined, locale: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

type AccessTokensPanelProps = {
  accessToken: string | null;
};

export function AccessTokensPanel({ accessToken }: AccessTokensPanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const currentUserId = accessToken ? getUserIdFromJwt(accessToken) : null;
  const canGlobalMetrics = accessToken ? getIsStaffFromJwt(accessToken) : false;

  const [rows, setRows] = useState<AdminPersonalAccessTokenRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [readOnlyToken, setReadOnlyToken] = useState(false);
  const [accessGlobalMetrics, setAccessGlobalMetrics] = useState(false);
  const [tokenLabel, setTokenLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    if (!accessToken || currentUserId == null) return;
    setLoading(true);
    setError(null);
    try {
      const kr = await fetchPersonalAccessTokens(accessToken);
      setRows(
        [...kr.results].sort((a, b) => Number(a.revoked_at != null) - Number(b.revoked_at != null)),
      );
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : t('accessTokensError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, currentUserId, t]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setPendingToken(null);
    setReadOnlyToken(false);
    setAccessGlobalMetrics(false);
    setTokenLabel('');
  }, [accessToken, currentUserId]);

  async function onCreate() {
    if (!accessToken || currentUserId == null) return;
    setCreating(true);
    try {
      const res = await createPersonalAccessToken(accessToken, {
        read_only: readOnlyToken,
        ...(canGlobalMetrics && accessGlobalMetrics ? { access_global_metrics: true } : {}),
        name: tokenLabel.trim() || undefined,
      });
      if (res.access_token) setPendingToken(res.access_token);
      await loadRows();
      setReadOnlyToken(false);
      setAccessGlobalMetrics(false);
      setTokenLabel('');
    } catch (e) {
      shellui.toast({
        title: e instanceof Error ? e.message : t('accessTokensError'),
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  }

  async function onRevoke(keyId: string, name?: string | null) {
    if (!accessToken) return;
    const label = name?.trim();
    const confirmed = await askShelluiConfirm({
      title: label
        ? t('accessTokensRevokeConfirmTitleNamed', { name: label })
        : t('accessTokensRevokeConfirmTitle'),
      description: t('accessTokensRevokeConfirmDescription'),
      okLabel: t('accessTokensRevokeConfirmOk'),
      cancelLabel: t('actionsCancel'),
      mode: 'delete',
    });
    if (!confirmed) return;
    setRevokingId(keyId);
    try {
      await revokePersonalAccessToken(accessToken, keyId);
      await loadRows();
    } catch (e) {
      shellui.toast({
        title: e instanceof Error ? e.message : t('accessTokensError'),
        type: 'error',
      });
    } finally {
      setRevokingId(null);
    }
  }

  async function copyPending() {
    if (!pendingToken) return;
    try {
      await navigator.clipboard.writeText(pendingToken);
      shellui.toast({ title: t('accessTokensCopied'), type: 'success' });
    } catch {
      shellui.toast({ title: t('accessTokensError'), type: 'error' });
    }
  }

  const card =
    'overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs';

  if (!accessToken) {
    return (
      <Alert>
        <AlertDescription>{t('usersNoSession')}</AlertDescription>
      </Alert>
    );
  }

  if (currentUserId == null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('accessTokensSessionUserError')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {pendingToken ? (
        <Alert
          variant="gold"
          role="status"
        >
          <KeyRound aria-hidden />
          <AlertTitle>{t('accessTokensOnceTitle')}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{t('accessTokensOnceHint')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 max-w-full flex-1 break-all rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs">
                {pendingToken}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyPending()}
              >
                <Copy aria-hidden />
                {t('accessTokensCopy')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setPendingToken(null)}
              >
                {t('accessTokensDismiss')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <section
        className={card}
        aria-labelledby="pat-create-title"
      >
        <div className="space-y-1 border-b border-border px-4 py-3">
          <h2
            id="pat-create-title"
            className="text-sm font-semibold"
          >
            {t('accessTokensCreateTitle')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('accessTokensHint')}</p>
        </div>
        <div className="space-y-4 p-4">
          <div className="max-w-md space-y-1.5">
            <Label htmlFor="pat-name">{t('accessTokensNameLabel')}</Label>
            <Input
              id="pat-name"
              placeholder={t('accessTokensNamePlaceholder')}
              value={tokenLabel}
              onChange={(ev) => setTokenLabel(ev.target.value)}
              maxLength={200}
            />
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            <label className="flex cursor-pointer items-start gap-3 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border accent-primary"
                checked={readOnlyToken}
                onChange={(ev) => setReadOnlyToken(ev.target.checked)}
              />
              <span>
                <span className="font-medium">{t('accessTokensReadOnlyLabel')}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t('accessTokensReadOnlyHint')}
                </span>
              </span>
            </label>
            {canGlobalMetrics ? (
              <label className="flex cursor-pointer items-start gap-3 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border accent-primary"
                  checked={accessGlobalMetrics}
                  onChange={(ev) => setAccessGlobalMetrics(ev.target.checked)}
                />
                <span>
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {t('accessTokensGlobalMetricsLabel')}
                    <StatusBadge tone="gold">{t('scheduledJobsStaffBadge')}</StatusBadge>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t('accessTokensGlobalMetricsHint')}
                  </span>
                </span>
              </label>
            ) : null}
          </div>
        </div>
        <div className="flex justify-end border-t border-border bg-muted/30 px-4 py-3">
          <Button
            type="button"
            disabled={creating || loading}
            onClick={() => void onCreate()}
          >
            {creating ? (
              <>
                <Loader2
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
                {t('accessTokensCreating')}
              </>
            ) : (
              t('accessTokensCreate')
            )}
          </Button>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadRows()}
            >
              {t('usersRetry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="pat-active-title">
        <h2
          id="pat-active-title"
          className="mb-3 text-sm font-semibold"
        >
          {t('accessTokensActiveTitle')}
        </h2>
        <DataTableCard
          label={t('accessTokensActiveTitle')}
          busy={loading}
        >
          {loading && rows.length === 0 ? (
            <SkeletonRows
              rows={3}
              columns={['w-32', 'w-20', 'w-24', 'w-28', 'w-28', 'w-16']}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title={t('accessTokensEmpty')}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('accessTokensColName')}</TableHead>
                  <TableHead>{t('accessTokensColAccess')}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('accessTokensColMetrics')}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('accessTokensColCreated')}
                  </TableHead>
                  <TableHead>{t('accessTokensColLastUsed')}</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">{t('accessTokensColActions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-sm">
                {rows.map((mk) => {
                  const revoked = mk.revoked_at != null;
                  const created =
                    typeof mk.created_at === 'string' ? formatDateTime(mk.created_at, locale) : '-';
                  const lastUsed =
                    mk.last_used_at && typeof mk.last_used_at === 'string'
                      ? formatDateTime(mk.last_used_at, locale)
                      : '-';
                  return (
                    <TableRow
                      key={mk.id}
                      className={revoked ? 'text-muted-foreground' : undefined}
                    >
                      <TableCell className="max-w-48 truncate font-medium">
                        {mk.name?.trim() ? mk.name : '-'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={mk.read_only ? 'muted' : 'warning'}>
                          {mk.read_only
                            ? t('accessTokensAccessReadOnly')
                            : t('accessTokensAccessReadWrite')}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {mk.access_global_metrics
                          ? t('accessTokensMetricsGlobal')
                          : t('accessTokensMetricsCompany')}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                        {created}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {lastUsed}
                      </TableCell>
                      <TableCell className="text-right">
                        {revoked ? (
                          <StatusBadge tone="muted">{t('accessTokensStatusRevoked')}</StatusBadge>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={revokingId === mk.id}
                            onClick={() => void onRevoke(mk.id, mk.name)}
                          >
                            {revokingId === mk.id ? (
                              <>
                                <Loader2
                                  className="animate-spin motion-reduce:animate-none"
                                  aria-hidden
                                />
                                {t('accessTokensRevoking')}
                              </>
                            ) : (
                              t('accessTokensRevoke')
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTableCard>
      </section>
    </div>
  );
}
