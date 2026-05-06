import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import shellui from '@shellui/sdk';
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
  if (!iso) return '—';
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
      setRows(kr.results.filter((r) => r.revoked_at == null));
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

  async function onRevoke(keyId: string) {
    if (!accessToken) return;
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

  if (!accessToken) {
    return <p className="text-sm text-muted-foreground">{t('usersNoSession')}</p>;
  }

  if (currentUserId == null) {
    return <p className="text-sm text-muted-foreground">{t('accessTokensSessionUserError')}</p>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {pendingToken ? (
        <div
          className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 dark:bg-amber-950/30"
          role="status"
        >
          <p className="text-sm font-medium">{t('accessTokensOnceTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('accessTokensOnceHint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full min-w-0 flex-1 break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">
              {pendingToken}
            </code>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void copyPending()}
            >
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
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-[12rem] max-w-lg flex-1 flex-col gap-1">
          <label
            className="text-sm font-medium"
            htmlFor="pat-name"
          >
            {t('accessTokensNameLabel')}
          </label>
          <Input
            id="pat-name"
            placeholder={t('accessTokensNamePlaceholder')}
            value={tokenLabel}
            onChange={(ev) => setTokenLabel(ev.target.value)}
            maxLength={200}
          />
        </div>
        <label className="flex max-w-lg cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 rounded border"
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
          <label className="flex max-w-lg cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border"
              checked={accessGlobalMetrics}
              onChange={(ev) => setAccessGlobalMetrics(ev.target.checked)}
            />
            <span>
              <span className="font-medium">{t('accessTokensGlobalMetricsLabel')}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t('accessTokensGlobalMetricsHint')}
              </span>
            </span>
          </label>
        ) : null}
        <Button
          type="button"
          disabled={creating || loading}
          onClick={() => void onCreate()}
          className="sm:ml-auto"
        >
          {creating ? (
            <>
              <Loader2
                className="mr-2 size-4 animate-spin"
                aria-hidden
              />
              {t('accessTokensCreating')}
            </>
          ) : (
            t('accessTokensCreate')
          )}
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-muted-foreground">
          <Loader2
            className="size-4 animate-spin"
            aria-hidden
          />
          <span className="text-sm">{t('accessTokensLoading')}</span>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('accessTokensEmpty')}</p>
      ) : (
        <div className="w-full overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('accessTokensColName')}
                </TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('accessTokensColAccess')}
                </TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('accessTokensColMetrics')}
                </TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('accessTokensColCreated')}
                </TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('accessTokensColLastUsed')}
                </TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('accessTokensColActions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-sm">
              {rows.map((mk) => {
                const created =
                  typeof mk.created_at === 'string' ? formatDateTime(mk.created_at, locale) : '—';
                const lastUsed =
                  mk.last_used_at && typeof mk.last_used_at === 'string'
                    ? formatDateTime(mk.last_used_at, locale)
                    : '—';
                return (
                  <TableRow key={mk.id}>
                    <TableCell className="max-w-[12rem] truncate font-medium">
                      {mk.name?.trim() ? mk.name : '—'}
                    </TableCell>
                    <TableCell>
                      {mk.read_only
                        ? t('accessTokensAccessReadOnly')
                        : t('accessTokensAccessReadWrite')}
                    </TableCell>
                    <TableCell>
                      {mk.access_global_metrics
                        ? t('accessTokensMetricsGlobal')
                        : t('accessTokensMetricsCompany')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {created}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {lastUsed}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={revokingId === mk.id}
                        onClick={() => void onRevoke(mk.id)}
                      >
                        {revokingId === mk.id ? (
                          <>
                            <Loader2 className="mr-1 size-3 animate-spin" />
                            {t('accessTokensRevoking')}
                          </>
                        ) : (
                          t('accessTokensRevoke')
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
