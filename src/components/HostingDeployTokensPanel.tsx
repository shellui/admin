import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, KeyRound, Loader2 } from 'lucide-react';
import shellui from '@shellui/sdk';
import { DataTableCard, SkeletonRows } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import {
  buildDeployWorkflowSnippet,
  createHostingDeployToken,
  fetchHostingDeployTokens,
  revokeHostingDeployToken,
  type HostingDeployToken,
} from '@/lib/hostingApi';

type Props = {
  hostingBaseUrl: string;
  accessToken: string;
};

function formatDate(value: string | null, locale: string): string {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString(locale);
}

function tokenState(row: HostingDeployToken): 'revoked' | 'expired' | 'active' {
  if (row.revoked_at) return 'revoked';
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
  return 'active';
}

async function copyText(value: string, ok: string, fail: string) {
  try {
    await navigator.clipboard.writeText(value);
    shellui.toast({ title: ok, type: 'success' });
  } catch {
    shellui.toast({ title: fail, type: 'error' });
  }
}

export function HostingDeployTokensPanel({ hostingBaseUrl, accessToken }: Props) {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<HostingDeployToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [days, setDays] = useState('');
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const snippet = buildDeployWorkflowSnippet();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchHostingDeployTokens(hostingBaseUrl, accessToken));
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : t('deployTokensError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, hostingBaseUrl, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate() {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const parsedDays = Number.parseInt(days, 10);
      const created = await createHostingDeployToken(hostingBaseUrl, accessToken, {
        name: name.trim(),
        ...(Number.isFinite(parsedDays) ? { expires_in_days: parsedDays } : {}),
      });
      setPending(created.token);
      setName('');
      setDays('');
      await load();
    } catch (e) {
      shellui.toast({
        title: e instanceof Error ? e.message : t('deployTokensError'),
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  }

  async function onRevoke(row: HostingDeployToken) {
    const confirmed = await askShelluiConfirm({
      title: t('deployTokensRevokeTitle', { name: row.name }),
      description: t('deployTokensRevokeDescription'),
      okLabel: t('deployTokensRevoke'),
      cancelLabel: t('actionsCancel'),
      mode: 'delete',
    });
    if (!confirmed) return;
    setRevokingId(row.id);
    try {
      await revokeHostingDeployToken(hostingBaseUrl, accessToken, row.id);
      await load();
    } catch (e) {
      shellui.toast({
        title: e instanceof Error ? e.message : t('deployTokensError'),
        type: 'error',
      });
    } finally {
      setRevokingId(null);
    }
  }

  const card =
    'overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm';

  return (
    <div className="space-y-6">
      {pending ? (
        <Alert
          variant="gold"
          role="status"
        >
          <KeyRound aria-hidden />
          <AlertTitle>{t('deployTokensOnceTitle')}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{t('deployTokensOnceHint')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 max-w-full flex-1 break-all rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs">
                {pending}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void copyText(pending, t('deployTokensCopied'), t('deployTokensError'))
                }
              >
                <Copy aria-hidden />
                {t('deployTokensCopy')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setPending(null)}
              >
                {t('deployTokensDismiss')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <section
        className={card}
        aria-labelledby="deploy-token-create-title"
      >
        <div className="space-y-1 border-b border-border px-4 py-3">
          <h2
            id="deploy-token-create-title"
            className="text-sm font-semibold"
          >
            {t('deployTokensCreateTitle')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('deployTokensHint')}</p>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="deploy-token-name">{t('deployTokensNameLabel')}</Label>
            <Input
              id="deploy-token-name"
              placeholder={t('deployTokensNamePlaceholder')}
              value={name}
              maxLength={100}
              onChange={(ev) => setName(ev.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deploy-token-days">{t('deployTokensExpiresLabel')}</Label>
            <Input
              id="deploy-token-days"
              type="number"
              min={1}
              max={366}
              placeholder={t('deployTokensExpiresPlaceholder')}
              value={days}
              onChange={(ev) => setDays(ev.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end border-t border-border bg-muted/30 px-4 py-3">
          <Button
            type="button"
            disabled={creating || !name.trim()}
            onClick={() => void onCreate()}
          >
            {creating ? (
              <Loader2
                className="animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : null}
            {t('deployTokensCreate')}
          </Button>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <DataTableCard
        label={t('deployTokensTitle')}
        busy={loading}
        toolbar={
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t('deployTokensTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('deployTokensDescription')}</p>
          </div>
        }
      >
        {loading && rows.length === 0 ? (
          <SkeletonRows
            rows={2}
            columns={['w-32', 'w-24', 'w-28', 'w-28', 'w-16']}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title={t('deployTokensEmpty')}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">{t('deployTokensColName')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('deployTokensColPrefix')}</TableHead>
                <TableHead>{t('deployTokensColLastUsed')}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('deployTokensColExpires')}
                </TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">{t('deployTokensColActions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-sm">
              {rows.map((row) => {
                const state = tokenState(row);
                return (
                  <TableRow
                    key={row.id}
                    className={state === 'active' ? undefined : 'text-muted-foreground'}
                  >
                    <TableCell className="max-w-[12rem] truncate pl-4 font-medium">
                      {row.name}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {row.prefix}…
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(row.last_used_at, i18n.language)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell">
                      {row.expires_at
                        ? formatDate(row.expires_at, i18n.language)
                        : t('deployTokensNever')}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {state === 'active' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={revokingId === row.id}
                          onClick={() => void onRevoke(row)}
                        >
                          {t('deployTokensRevoke')}
                        </Button>
                      ) : (
                        <StatusBadge tone="muted">
                          {state === 'revoked'
                            ? t('deployTokensRevoked')
                            : t('deployTokensExpired')}
                        </StatusBadge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataTableCard>

      <section
        className={card}
        aria-labelledby="deploy-cli-title"
      >
        <div className="space-y-1 border-b border-border px-4 py-3">
          <h2
            id="deploy-cli-title"
            className="text-sm font-semibold"
          >
            {t('deployCliTitle')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('deployCliHint')}</p>
        </div>
        <div className="space-y-3 p-4">
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
            {snippet}
          </pre>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void copyText(snippet, t('deployTokensCopied'), t('deployTokensError'))}
          >
            <Copy aria-hidden />
            {t('deployCliCopy')}
          </Button>
        </div>
      </section>
    </div>
  );
}
