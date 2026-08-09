import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  FileText,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import {
  fetchStorageStats,
  useStorageBaseUrl,
  type StorageStatsSnapshot,
} from '@/lib/storageStatsApi';

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

  if (!storageBaseUrl) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-8 md:px-6">
        <h1 className="text-xl font-semibold tracking-tight">{t('storageStatsMissingTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('storageStatsMissingDescription')}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              {t('storageStatsTitle')}
            </h1>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] uppercase"
            >
              {t('storageStatsBadge')}
            </Badge>
          </div>
          <Text className="max-w-3xl font-mono text-sm">{t('storageStatsDescription')}</Text>
          <Text className="font-mono text-xs text-muted-foreground">{storageBaseUrl}</Text>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          disabled={loading}
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('storageStatsRefresh')}
        </button>
      </header>

      {!accessToken && (
        <Text className="font-mono text-sm text-muted-foreground">
          {t('storageStatsNoSession')}
        </Text>
      )}

      {accessToken && loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('storageStatsLoading')}
        </div>
      )}

      {error && <Text className="font-mono text-sm text-destructive">{error}</Text>}

      {snapshot && !loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatBlock
              label={t('storageStatsObjects')}
              value={formatInt(snapshot.object_count)}
              hint={snapshot.total_bytes_display}
              icon={HardDrive}
            />
            <StatBlock
              label={t('storageStatsDocuments')}
              value={formatInt(snapshot.document_count)}
              hint={snapshot.document_bytes_display}
              icon={FileText}
            />
            <StatBlock
              label={t('storageStatsBuckets')}
              value={formatInt(snapshot.bucket_count)}
              hint={t('storageStatsCompaniesHint', { count: snapshot.company_count })}
              icon={FolderOpen}
            />
            <StatBlock
              label={t('storageStatsUploads7d')}
              value={formatInt(snapshot.uploads_7d)}
              hint={`${snapshot.bytes_7d_display} · ${formatInt(snapshot.uploads_24h)} ${t('storageStatsToday')}`}
              icon={Upload}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="size-4" />
                  {t('storageStatsDailyTitle')}
                </CardTitle>
                <CardDescription>{t('storageStatsDailyDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="flex h-28 items-end gap-0.5"
                  aria-label={t('storageStatsDailyTitle')}
                >
                  {snapshot.daily_series.map((row) => (
                    <div
                      key={row.day}
                      className="flex h-full min-w-0 flex-1 items-end rounded-sm bg-muted"
                      title={`${row.day}: ${row.object_count} (${row.total_bytes_display})`}
                    >
                      <div
                        className="w-full rounded-sm bg-primary"
                        style={{
                          height: `${Math.max(row.bar_pct, row.object_count > 0 ? 4 : 0)}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{t('storageStatsFamiliesTitle')}</CardTitle>
                <CardDescription>{t('storageStatsFamiliesDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                {snapshot.by_family.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">{t('storageStatsEmpty')}</Text>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="py-1.5 font-medium">{t('storageStatsColFamily')}</th>
                        <th className="py-1.5 font-medium">{t('storageStatsColFiles')}</th>
                        <th className="py-1.5 font-medium">{t('storageStatsColSize')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.by_family.map((row) => (
                        <tr
                          key={row.family}
                          className="border-b border-border/60"
                        >
                          <td className="py-1.5">{row.family}</td>
                          <td className="py-1.5 font-mono tabular-nums">{row.object_count}</td>
                          <td className="py-1.5 font-mono">{row.total_bytes_display}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{t('storageStatsBucketsTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                {snapshot.by_bucket.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">{t('storageStatsEmpty')}</Text>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="py-1.5 font-medium">{t('storageStatsColBucket')}</th>
                        <th className="py-1.5 font-medium">{t('storageStatsColFiles')}</th>
                        <th className="py-1.5 font-medium">{t('storageStatsColSize')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.by_bucket.slice(0, 10).map((row) => (
                        <tr
                          key={row.label}
                          className="border-b border-border/60"
                        >
                          <td className="py-1.5 font-mono text-xs">{row.label}</td>
                          <td className="py-1.5 font-mono tabular-nums">{row.object_count}</td>
                          <td className="py-1.5 font-mono">{row.total_bytes_display}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{t('storageStatsQuotasTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                {snapshot.quotas.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">{t('storageStatsEmpty')}</Text>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="py-1.5 font-medium">{t('storageStatsColCompany')}</th>
                        <th className="py-1.5 font-medium">{t('storageStatsColUsed')}</th>
                        <th className="py-1.5 font-medium">{t('storageStatsColLimit')}</th>
                        <th className="py-1.5 font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.quotas.map((row) => (
                        <tr
                          key={row.company_id}
                          className="border-b border-border/60"
                        >
                          <td className="py-1.5 font-mono">{row.company_id}</td>
                          <td className="py-1.5 font-mono">{row.used_display}</td>
                          <td className="py-1.5 font-mono">{row.max_display}</td>
                          <td className="py-1.5 font-mono tabular-nums">{row.pct}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t('storageStatsRecentTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {snapshot.recent.length === 0 ? (
                <Text className="text-sm text-muted-foreground">{t('storageStatsEmpty')}</Text>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-1.5 font-medium">{t('storageStatsColFile')}</th>
                      <th className="py-1.5 font-medium">{t('storageStatsColBucket')}</th>
                      <th className="py-1.5 font-medium">{t('storageStatsColMime')}</th>
                      <th className="py-1.5 font-medium">{t('storageStatsColSize')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.recent.map((row) => (
                      <tr
                        key={`${row.bucket}:${row.name}`}
                        className="border-b border-border/60"
                      >
                        <td className="py-1.5">
                          <span className="font-medium">{row.basename}</span>
                          {row.is_document ? (
                            <Badge
                              variant="secondary"
                              className="ml-2 text-[10px]"
                            >
                              doc
                            </Badge>
                          ) : null}
                        </td>
                        <td className="py-1.5 font-mono text-xs">
                          c{row.company_id}/{row.bucket}
                        </td>
                        <td className="py-1.5 font-mono text-xs text-muted-foreground">
                          {row.mime_type}
                        </td>
                        <td className="py-1.5 font-mono">{row.size_display}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {snapshot.generated_at ? (
            <Text className="font-mono text-xs text-muted-foreground">
              {t('storageStatsGeneratedAt', {
                value: new Date(snapshot.generated_at).toLocaleString(),
              })}
            </Text>
          ) : null}
        </>
      )}
    </div>
  );
}
