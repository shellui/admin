import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { AppWindow, BarChart3, HardDrive, Loader2, RefreshCw, Rocket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { fetchHostingStats, useHostingBaseUrl, type HostingStatsSnapshot } from '@/lib/hostingApi';

function StatBlock({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </CardDescription>
        <Icon
          className="size-4 text-muted-foreground"
          aria-hidden
        />
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        <Text className="mt-1 font-mono text-xs">{hint}</Text>
      </CardContent>
    </Card>
  );
}

function formatInt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function HostingStatisticsPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const hostingBaseUrl = useHostingBaseUrl();
  const [snapshot, setSnapshot] = useState<HostingStatsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !hostingBaseUrl) {
      setLoading(false);
      setSnapshot(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchHostingStats(hostingBaseUrl, accessToken));
    } catch (e) {
      setSnapshot(null);
      setError(e instanceof Error ? e.message : t('hostingStatsError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, hostingBaseUrl, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hostingBaseUrl) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-8 md:px-6">
        <h1 className="text-xl font-semibold tracking-tight">{t('hostingStatsMissingTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('hostingStatsMissingDescription')}</p>
      </div>
    );
  }

  const statusRows = snapshot
    ? Object.entries(snapshot.deployments_by_status).sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <div className="w-full space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              {t('hostingStatsTitle')}
            </h1>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] uppercase"
            >
              {t('hostingStatsBadge')}
            </Badge>
          </div>
          <Text className="max-w-3xl font-mono text-sm">{t('hostingStatsDescription')}</Text>
          <Text className="font-mono text-xs text-muted-foreground">{hostingBaseUrl}</Text>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          disabled={loading}
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('hostingStatsRefresh')}
        </button>
      </header>

      {!accessToken && (
        <Text className="font-mono text-sm text-muted-foreground">{t('hostingNoSession')}</Text>
      )}

      {accessToken && loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('hostingStatsLoading')}
        </div>
      )}

      {error && <Text className="font-mono text-sm text-destructive">{error}</Text>}

      {snapshot && !loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatBlock
              label={t('hostingStatsApps')}
              value={formatInt(snapshot.apps)}
              icon={AppWindow}
            />
            <StatBlock
              label={t('hostingStatsDeployments')}
              value={formatInt(snapshot.deployments)}
              hint={t('hostingStatsActiveHint', { count: snapshot.active_deployments })}
              icon={Rocket}
            />
            <StatBlock
              label={t('hostingStatsArtifacts')}
              value={formatBytes(snapshot.artifact_bytes)}
              hint={t('hostingStatsArtifactsHint')}
              icon={HardDrive}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="size-4" />
                  {t('hostingStatsByStatusTitle')}
                </CardTitle>
                <CardDescription>{t('hostingStatsByStatusDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                {statusRows.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">{t('hostingStatsEmpty')}</Text>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="py-1.5 font-medium">{t('hostingColStatus')}</th>
                        <th className="py-1.5 font-medium">{t('hostingColCount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusRows.map(([status, count]) => (
                        <tr
                          key={status}
                          className="border-b border-border/60"
                        >
                          <td className="py-1.5 font-mono text-xs">{status}</td>
                          <td className="py-1.5 font-mono tabular-nums">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{t('hostingStatsAccessTitle')}</CardTitle>
                <CardDescription>{t('hostingStatsAccessDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-1.5 font-medium">{t('hostingColStatus')}</th>
                      <th className="py-1.5 font-medium">{t('hostingColCount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/60">
                      <td className="py-1.5">{t('hostingAccessStatus_pending')}</td>
                      <td className="py-1.5 font-mono tabular-nums">{snapshot.access.pending}</td>
                    </tr>
                    <tr className="border-b border-border/60">
                      <td className="py-1.5">{t('hostingAccessStatus_approved')}</td>
                      <td className="py-1.5 font-mono tabular-nums">{snapshot.access.approved}</td>
                    </tr>
                    <tr className="border-b border-border/60">
                      <td className="py-1.5">{t('hostingAccessStatus_denied')}</td>
                      <td className="py-1.5 font-mono tabular-nums">{snapshot.access.denied}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
