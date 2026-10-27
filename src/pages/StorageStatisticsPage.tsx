import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, FolderOpen, HardDrive, RefreshCw, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { KpiCard, KpiRow, KpiSkeletonRow } from '@/components/admin/Kpi';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { BarSeriesCard, StatTableCard } from '@/components/admin/StatsParts';
import { getIsStaffFromJwt } from '@/lib/jwtCompany';
import { cn } from '@/lib/utils';
import { DashboardScheduledJobsSection } from '@/components/DashboardScheduledJobsSection';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import {
  fetchStorageStats,
  useStorageBaseUrl,
  type StorageStatsSnapshot,
} from '@/lib/storageStatsApi';

function formatInt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function StorageStatisticsPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const storageBaseUrl = useStorageBaseUrl();
  const [snapshot, setSnapshot] = useState<StorageStatsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !storageBaseUrl) {
      setLoading(false);
      setSnapshot(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchStorageStats(storageBaseUrl, accessToken, 14));
    } catch (e) {
      setSnapshot(null);
      setError(e instanceof Error ? e.message : t('storageStatsError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, storageBaseUrl, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const isStaff = Boolean(accessToken && getIsStaffFromJwt(accessToken));
  const empty = t('storageStatsEmpty');

  if (!storageBaseUrl) {
    return (
      <div className="w-full space-y-6">
        <PageHeader
          title={t('storageStatsTitle')}
          service={t('storageStatsBadge')}
        />
        <Alert variant="warning">
          <AlertTitle>{t('storageStatsMissingTitle')}</AlertTitle>
          <AlertDescription>{t('storageStatsMissingDescription')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const series = snapshot?.daily_series ?? [];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('storageStatsTitle')}
        service={t('storageStatsBadge')}
        description={
          <>
            <span className="block">{t('storageStatsDescription')}</span>
            <span className="mt-1 block font-mono text-xs text-muted-foreground">
              {storageBaseUrl}
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
            {t('storageStatsRefresh')}
          </Button>
        }
      />

      {!accessToken && (
        <Alert variant="info">
          <AlertDescription>{t('storageStatsNoSession')}</AlertDescription>
        </Alert>
      )}

      {accessToken && loading && <KpiSkeletonRow label={t('storageStatsLoading')} />}

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="font-mono text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {snapshot && !loading && (
        <>
          <KpiRow label={t('storageStatsTitle')}>
            <KpiCard
              label={t('storageStatsObjects')}
              value={formatInt(snapshot.object_count)}
              hint={snapshot.total_bytes_display}
              icon={HardDrive}
            />
            <KpiCard
              label={t('storageStatsDocuments')}
              value={formatInt(snapshot.document_count)}
              hint={snapshot.document_bytes_display}
              icon={FileText}
            />
            <KpiCard
              label={t('storageStatsBuckets')}
              value={formatInt(snapshot.bucket_count)}
              hint={
                isStaff
                  ? t('storageStatsCompaniesHint', { count: snapshot.company_count })
                  : undefined
              }
              icon={FolderOpen}
            />
            <KpiCard
              label={t('storageStatsUploads7d')}
              value={formatInt(snapshot.uploads_7d)}
              hint={`${snapshot.bytes_7d_display} · ${formatInt(snapshot.uploads_24h)} ${t('storageStatsToday')}`}
              icon={Upload}
            />
          </KpiRow>

          <div className="grid gap-4 lg:grid-cols-2">
            <BarSeriesCard
              title={t('storageStatsDailyTitle')}
              description={t('storageStatsDailyDescription')}
              dayLabel={t('statsColDay')}
              valueLabel={t('storageStatsDailyDescription')}
              bars={series.map((row, idx) => ({
                key: row.day,
                label: row.day.slice(5),
                value: row.object_count,
                pct: row.bar_pct,
                title: `${row.day}: ${row.object_count} (${row.total_bytes_display})`,
                recent: idx >= series.length - 7,
              }))}
            />
            <StatTableCard
              title={t('storageStatsFamiliesTitle')}
              description={t('storageStatsFamiliesDescription')}
              empty={empty}
              columns={[
                { label: t('storageStatsColFamily') },
                {
                  label: t('storageStatsColFiles'),
                  className: 'text-right font-mono tabular-nums',
                },
                { label: t('storageStatsColSize'), className: 'text-right font-mono' },
              ]}
              rows={snapshot.by_family.map((row) => ({
                key: row.family,
                cells: [row.family, row.object_count, row.total_bytes_display],
              }))}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <StatTableCard
              title={t('storageStatsBucketsTitle')}
              empty={empty}
              columns={[
                { label: t('storageStatsColBucket'), className: 'font-mono text-xs' },
                {
                  label: t('storageStatsColFiles'),
                  className: 'text-right font-mono tabular-nums',
                },
                { label: t('storageStatsColSize'), className: 'text-right font-mono' },
              ]}
              rows={snapshot.by_bucket.slice(0, 10).map((row) => ({
                key: row.label,
                cells: [row.label, row.object_count, row.total_bytes_display],
              }))}
            />
            <StatTableCard
              title={t('storageStatsQuotasTitle')}
              empty={empty}
              columns={[
                { label: t('storageStatsColCompany'), className: 'font-mono' },
                { label: t('storageStatsColUsed'), className: 'font-mono' },
                { label: t('storageStatsColLimit'), className: 'font-mono' },
                { label: '%', className: 'text-right font-mono tabular-nums' },
              ]}
              rows={snapshot.quotas.map((row) => ({
                key: String(row.company_id),
                cells: [row.company_id, row.used_display, row.max_display, row.pct],
              }))}
            />
          </div>

          <StatTableCard
            title={t('storageStatsRecentTitle')}
            empty={empty}
            columns={[
              { label: t('storageStatsColFile') },
              { label: t('storageStatsColBucket'), className: 'font-mono text-xs' },
              {
                label: t('storageStatsColMime'),
                className: 'hidden font-mono text-xs text-muted-foreground md:table-cell',
              },
              { label: t('storageStatsColSize'), className: 'text-right font-mono' },
            ]}
            rows={snapshot.recent.map((row) => ({
              key: `${row.bucket}:${row.name}`,
              cells: [
                <span
                  key="f"
                  className="inline-flex items-center gap-2"
                >
                  <span className="font-medium">{row.basename}</span>
                  {row.is_document ? <StatusBadge tone="muted">doc</StatusBadge> : null}
                </span>,
                `c${row.company_id}/${row.bucket}`,
                row.mime_type,
                row.size_display,
              ],
            }))}
            footer={
              snapshot.generated_at
                ? t('storageStatsGeneratedAt', {
                    value: new Date(snapshot.generated_at).toLocaleString(),
                  })
                : undefined
            }
          />
        </>
      )}

      <DashboardScheduledJobsSection
        baseUrl={storageBaseUrl}
        service="storage"
      />
    </div>
  );
}
