import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppWindow, HardDrive, RefreshCw, Rocket } from 'lucide-react';
import { KpiCard, KpiRow, KpiSkeletonRow } from '@/components/admin/Kpi';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatTableCard } from '@/components/admin/StatsParts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DashboardScheduledJobsSection } from '@/components/DashboardScheduledJobsSection';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { fetchHostingStats, useHostingBaseUrl, type HostingStatsSnapshot } from '@/lib/hostingApi';
import { cn } from '@/lib/utils';

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

  const header = (
    <PageHeader
      title={t('hostingStatsTitle')}
      service={t('hostingStatsBadge')}
      description={
        hostingBaseUrl ? (
          <>
            <span className="block">{t('hostingStatsDescription')}</span>
            <span className="mt-1 block font-mono text-xs text-muted-foreground">
              {hostingBaseUrl}
            </span>
          </>
        ) : (
          t('hostingStatsDescription')
        )
      }
      actions={
        hostingBaseUrl ? (
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
            {t('hostingStatsRefresh')}
          </Button>
        ) : undefined
      }
    />
  );

  if (!hostingBaseUrl) {
    return (
      <div className="w-full space-y-6">
        {header}
        <Alert variant="warning">
          <AlertTitle>{t('hostingStatsMissingTitle')}</AlertTitle>
          <AlertDescription>{t('hostingStatsMissingDescription')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusRows = snapshot
    ? Object.entries(snapshot.deployments_by_status).sort(([a], [b]) => a.localeCompare(b))
    : [];
  const countCols = [
    { label: t('hostingColStatus') },
    { label: t('hostingColCount'), className: 'text-right' },
  ];

  return (
    <div className="w-full space-y-6">
      {header}

      {!accessToken && (
        <Alert variant="info">
          <AlertDescription>{t('hostingNoSession')}</AlertDescription>
        </Alert>
      )}

      {accessToken && loading && (
        <KpiSkeletonRow
          columns={3}
          label={t('hostingStatsLoading')}
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="font-mono text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {snapshot && !loading && (
        <>
          <KpiRow
            columns={3}
            label={t('hostingStatsTitle')}
          >
            <KpiCard
              label={t('hostingStatsApps')}
              value={formatInt(snapshot.apps)}
              icon={AppWindow}
            />
            <KpiCard
              label={t('hostingStatsDeployments')}
              value={formatInt(snapshot.deployments)}
              hint={t('hostingStatsActiveHint', { count: snapshot.active_deployments })}
              icon={Rocket}
            />
            <KpiCard
              label={t('hostingStatsArtifacts')}
              value={formatBytes(snapshot.artifact_bytes)}
              hint={t('hostingStatsArtifactsHint')}
              icon={HardDrive}
            />
          </KpiRow>

          <div className="grid gap-4 lg:grid-cols-2">
            <StatTableCard
              title={t('hostingStatsByStatusTitle')}
              description={t('hostingStatsByStatusDescription')}
              columns={countCols}
              rows={statusRows.map(([status, count]) => ({
                key: status,
                cells: [
                  <span className="font-mono text-xs">{status}</span>,
                  <span className="tabular-nums">{formatInt(count)}</span>,
                ],
              }))}
              empty={t('hostingStatsEmpty')}
            />
            <StatTableCard
              title={t('hostingStatsAccessTitle')}
              description={t('hostingStatsAccessDescription')}
              columns={countCols}
              rows={(['pending', 'approved', 'denied'] as const).map((k) => ({
                key: k,
                cells: [
                  t(`hostingAccessStatus_${k}`),
                  <span className="tabular-nums">{formatInt(snapshot.access[k])}</span>,
                ],
              }))}
              empty={t('hostingStatsEmpty')}
            />
          </div>
        </>
      )}

      <DashboardScheduledJobsSection
        baseUrl={hostingBaseUrl}
        service="hosting"
      />
    </div>
  );
}
