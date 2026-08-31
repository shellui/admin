import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ExternalLink,
  FileText,
  Gauge,
  HardDrive,
  Link2,
  Loader2,
  Shield,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import {
  buildStaffPrometheusMetricsUrl,
  fetchAuthMetricsSnapshot,
  type AuthMetricsSnapshot,
} from '@/lib/authMetricsApi';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';
import {
  buildStoragePrometheusMetricsUrl,
  fetchStorageMetricsSnapshot,
  formatBytes,
  type StorageMetricsSnapshot,
} from '@/lib/storageMetricsApi';
import { useStorageBaseUrl } from '@/lib/storageStatsApi';

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

type MetricsSourceId = 'identity' | 'storage';

export function DashboardPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const storageBaseUrl = useStorageBaseUrl();
  const storageEnabled = Boolean(storageBaseUrl);

  const [snapshot, setSnapshot] = useState<AuthMetricsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [storageSnapshot, setStorageSnapshot] = useState<StorageMetricsSnapshot | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  const [metricsSource, setMetricsSource] = useState<MetricsSourceId>('identity');

  const loadIdentity = useCallback(
    async (opts?: { showLoading?: boolean }) => {
      if (!accessToken) {
        setLoading(false);
        setSnapshot(null);
        setError(null);
        return;
      }
      if (opts?.showLoading) setLoading(true);
      setError(null);
      try {
        setSnapshot(await fetchAuthMetricsSnapshot(accessToken));
      } catch (e) {
        setSnapshot(null);
        const msg = e instanceof Error ? e.message : t('dashboardError');
        if (msg === 'Forbidden' || /403/.test(msg)) {
          setError(t('dashboardForbidden'));
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    [accessToken, t],
  );

  const loadStorage = useCallback(
    async (opts?: { showLoading?: boolean }) => {
      if (!accessToken || !storageBaseUrl) {
        setStorageLoading(false);
        setStorageSnapshot(null);
        setStorageError(null);
        return;
      }
      if (opts?.showLoading) setStorageLoading(true);
      setStorageError(null);
      try {
        setStorageSnapshot(await fetchStorageMetricsSnapshot(storageBaseUrl, accessToken));
      } catch (e) {
        setStorageSnapshot(null);
        const msg = e instanceof Error ? e.message : t('dashboardStorageError');
        if (msg === 'Forbidden' || /403/.test(msg)) {
          setStorageError(t('dashboardStorageForbidden'));
        } else {
          setStorageError(msg);
        }
      } finally {
        setStorageLoading(false);
      }
    },
    [accessToken, storageBaseUrl, t],
  );

  // Refetch only when the session/storage endpoint changes — not on theme/settings pushes.
  useEffect(() => {
    void loadIdentity({ showLoading: true });
    // intentionally omit loadIdentity: recreate on `t` must not blank KPIs
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accessToken only
  }, [accessToken]);

  useEffect(() => {
    void loadStorage({ showLoading: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accessToken + storageBaseUrl only
  }, [accessToken, storageBaseUrl]);

  const inactive =
    snapshot != null ? Math.max(0, Math.round(snapshot.usersTotal - snapshot.usersActive)) : 0;

  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const identityMetricsUrl = companyId != null ? buildStaffPrometheusMetricsUrl() : null;
  const storageMetricsUrl =
    storageEnabled && storageBaseUrl && companyId != null
      ? buildStoragePrometheusMetricsUrl(storageBaseUrl)
      : null;

  const sources = useMemo(() => {
    const list: { id: MetricsSourceId; label: string; url: string | null; rawText: string }[] = [];
    if (snapshot) {
      list.push({
        id: 'identity',
        label: t('dashboardExpositionSourceIdentity'),
        url: identityMetricsUrl,
        rawText: snapshot.rawText,
      });
    }
    if (storageSnapshot) {
      list.push({
        id: 'storage',
        label: t('dashboardExpositionSourceStorage'),
        url: storageMetricsUrl,
        rawText: storageSnapshot.rawText,
      });
    }
    return list;
  }, [identityMetricsUrl, snapshot, storageMetricsUrl, storageSnapshot, t]);

  useEffect(() => {
    if (sources.length === 0) return;
    if (!sources.some((s) => s.id === metricsSource)) {
      setMetricsSource(sources[0].id);
    }
  }, [metricsSource, sources]);

  const selectedSource = sources.find((s) => s.id === metricsSource) ?? sources[0] ?? null;

  return (
    <div className="w-full space-y-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('dashboardTitle')}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            {t('dashboardEnvBadge')}
          </Badge>
        </div>
        <Text className="max-w-3xl font-mono text-sm">{t('dashboardDescription')}</Text>
      </header>

      {!accessToken && (
        <Text className="font-mono text-sm text-muted-foreground">{t('dashboardNoSession')}</Text>
      )}

      {accessToken && loading && (
        <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
          <Loader2
            className="size-4 animate-spin"
            aria-hidden
          />
          {t('dashboardLoading')}
        </div>
      )}

      {accessToken && error && <Text className="font-mono text-sm text-destructive">{error}</Text>}

      {accessToken && !loading && !error && snapshot && (
        <>
          <section
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label={t('dashboardKpiSection')}
          >
            <StatBlock
              label={t('dashboardStatUsersTotal')}
              value={formatInt(snapshot.usersTotal)}
              hint={t('dashboardStatUsersTotalHint')}
              icon={Users}
            />
            <StatBlock
              label={t('dashboardStatUsersActive')}
              value={formatInt(snapshot.usersActive)}
              hint={t('dashboardStatUsersActiveHint', { inactive: formatInt(inactive) })}
              icon={UserCheck}
            />
            <StatBlock
              label={t('dashboardStatUsersStaff')}
              value={formatInt(snapshot.usersStaff)}
              hint={t('dashboardStatUsersStaffHint')}
              icon={Shield}
            />
            <StatBlock
              label={t('dashboardStatSocialLinks')}
              value={formatInt(snapshot.socialAccountsTotal)}
              hint={t('dashboardStatSocialLinksHint')}
              icon={Link2}
            />
          </section>

          <section
            className="grid gap-4 sm:grid-cols-3"
            aria-label={t('dashboardActivitySection')}
          >
            <StatBlock
              label={t('dashboardStatDau')}
              value={formatInt(snapshot.dailyActiveUsers)}
              hint={t('dashboardStatDauHint')}
              icon={Calendar}
            />
            <StatBlock
              label={t('dashboardStatWau')}
              value={formatInt(snapshot.weeklyActiveUsers)}
              hint={t('dashboardStatWauHint')}
              icon={CalendarRange}
            />
            <StatBlock
              label={t('dashboardStatMau')}
              value={formatInt(snapshot.monthlyActiveUsers)}
              hint={t('dashboardStatMauHint')}
              icon={CalendarDays}
            />
          </section>
        </>
      )}

      {accessToken && storageEnabled && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              {t('dashboardStorageSection')}
            </h2>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] uppercase"
            >
              {t('dashboardStorageBadge')}
            </Badge>
          </div>
          <Text className="max-w-3xl font-mono text-sm">{t('dashboardStorageDescription')}</Text>

          {storageLoading && (
            <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <Loader2
                className="size-4 animate-spin"
                aria-hidden
              />
              {t('dashboardStorageLoading')}
            </div>
          )}

          {storageError && (
            <Text className="font-mono text-sm text-destructive">{storageError}</Text>
          )}

          {!storageLoading && !storageError && storageSnapshot && (
            <div
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              aria-label={t('dashboardStorageSection')}
            >
              <StatBlock
                label={t('dashboardStatStorageObjects')}
                value={formatInt(storageSnapshot.objectsTotal)}
                hint={t('dashboardStatStorageObjectsHint', {
                  size: formatBytes(storageSnapshot.bytesTotal),
                })}
                icon={HardDrive}
              />
              <StatBlock
                label={t('dashboardStatStorageDocuments')}
                value={formatInt(storageSnapshot.documentsTotal)}
                hint={t('dashboardStatStorageDocumentsHint', {
                  size: formatBytes(storageSnapshot.documentBytes),
                })}
                icon={FileText}
              />
              <StatBlock
                label={t('dashboardStatStorageQuota')}
                value={formatBytes(storageSnapshot.quotaUsedBytes)}
                hint={t('dashboardStatStorageQuotaHint', {
                  used: formatBytes(storageSnapshot.quotaUsedBytes),
                  max: formatBytes(storageSnapshot.quotaMaxBytes),
                })}
                icon={Gauge}
              />
              <StatBlock
                label={t('dashboardStatStorageUploads')}
                value={formatInt(storageSnapshot.uploads7d)}
                hint={t('dashboardStatStorageUploadsHint', {
                  today: formatInt(storageSnapshot.uploads24h),
                  size: formatBytes(storageSnapshot.bytes7d),
                })}
                icon={Upload}
              />
            </div>
          )}
        </section>
      )}

      {selectedSource && (
        <details className="group rounded-lg border border-border/80 bg-card text-card-foreground shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-6 [&::-webkit-details-marker]:hidden">
            <div className="space-y-1.5">
              <CardTitle className="font-heading text-lg">
                {t('dashboardExpositionTitle')}
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                {t('dashboardExpositionDescription')}
              </CardDescription>
            </div>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="space-y-3 px-6 pb-6">
            {sources.length > 1 && (
              <label className="flex flex-col gap-1.5 font-mono text-xs text-muted-foreground">
                {t('dashboardExpositionSourceLabel')}
                <select
                  className="h-8 max-w-md rounded-md border border-input bg-background px-2 text-foreground"
                  value={selectedSource.id}
                  onChange={(e) => setMetricsSource(e.target.value as MetricsSourceId)}
                >
                  {sources.map((source) => (
                    <option
                      key={source.id}
                      value={source.id}
                    >
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selectedSource.url && (
              <div>
                <a
                  href={selectedSource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-primary underline-offset-4 hover:underline"
                >
                  <ExternalLink
                    className="size-3.5 shrink-0"
                    aria-hidden
                  />
                  {t('dashboardMetricsEndpointLink')}
                </a>
                <Text className="mt-1.5 block font-mono text-[10px] text-muted-foreground">
                  {t('dashboardMetricsEndpointHint')}
                </Text>
              </div>
            )}
            <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {selectedSource.rawText.trim()}
            </pre>
          </div>
        </details>
      )}

      <Separator className="bg-border" />

      <Text className="font-mono text-xs text-muted-foreground">{t('dashboardUiHint')}</Text>
    </div>
  );
}
