import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  FileText,
  Gauge,
  HardDrive,
  Link2,
  Package,
  Rocket,
  Shield,
  Upload,
  UserCheck,
  Users,
  AppWindow,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/admin/PageHeader';
import { KpiCard, KpiRow, KpiSkeletonRow, ServiceSectionHeader } from '@/components/admin/Kpi';
import { Text } from '@/components/ui/text';
import { DashboardAiSection } from '@/components/DashboardAiSection';
import { DashboardEmailSection } from '@/components/DashboardEmailSection';
import { AllServicesRetentionAlerts } from '@/components/EventRetentionAlert';
import { IdentityBackendMissing } from '@/components/ServiceUrlMissing';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { useShelluiAuthBackendBaseUrl } from '@/hooks/useShelluiAuthBackendBaseUrl';
import { fetchAuthMetricsSnapshot, type AuthMetricsSnapshot } from '@/lib/authMetricsApi';
import { fetchHostingMetricsSnapshot, type HostingMetricsSnapshot } from '@/lib/hostingMetricsApi';
import { useHostingBaseUrl } from '@/lib/hostingApi';
import {
  fetchStorageMetricsSnapshot,
  formatBytes,
  type StorageMetricsSnapshot,
} from '@/lib/storageMetricsApi';
import { useStorageBaseUrl } from '@/lib/storageStatsApi';

function formatInt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function DashboardPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const authBackendBaseUrl = useShelluiAuthBackendBaseUrl();
  const storageBaseUrl = useStorageBaseUrl();
  const storageEnabled = Boolean(storageBaseUrl);
  const hostingBaseUrl = useHostingBaseUrl();
  const hostingEnabled = Boolean(hostingBaseUrl);

  const [snapshot, setSnapshot] = useState<AuthMetricsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [storageSnapshot, setStorageSnapshot] = useState<StorageMetricsSnapshot | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  const [hostingSnapshot, setHostingSnapshot] = useState<HostingMetricsSnapshot | null>(null);
  const [hostingLoading, setHostingLoading] = useState(false);
  const [hostingError, setHostingError] = useState<string | null>(null);

  const loadIdentity = useCallback(
    async (opts?: { showLoading?: boolean }) => {
      if (!accessToken || !authBackendBaseUrl) {
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
    [accessToken, authBackendBaseUrl, t],
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

  const loadHosting = useCallback(
    async (opts?: { showLoading?: boolean }) => {
      if (!accessToken || !hostingBaseUrl) {
        setHostingLoading(false);
        setHostingSnapshot(null);
        setHostingError(null);
        return;
      }
      if (opts?.showLoading) setHostingLoading(true);
      setHostingError(null);
      try {
        setHostingSnapshot(await fetchHostingMetricsSnapshot(hostingBaseUrl, accessToken));
      } catch (e) {
        setHostingSnapshot(null);
        const msg = e instanceof Error ? e.message : t('dashboardHostingError');
        if (msg === 'Forbidden' || /403/.test(msg)) {
          setHostingError(t('dashboardHostingForbidden'));
        } else {
          setHostingError(msg);
        }
      } finally {
        setHostingLoading(false);
      }
    },
    [accessToken, hostingBaseUrl, t],
  );

  // Refetch only when the session/storage endpoint changes — not on theme/settings pushes.
  useEffect(() => {
    void loadIdentity({ showLoading: true });
    // intentionally omit loadIdentity: recreate on `t` must not blank KPIs
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session and identity URL only
  }, [accessToken, authBackendBaseUrl]);

  useEffect(() => {
    void loadStorage({ showLoading: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accessToken + storageBaseUrl only
  }, [accessToken, storageBaseUrl]);

  useEffect(() => {
    void loadHosting({ showLoading: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accessToken + hostingBaseUrl only
  }, [accessToken, hostingBaseUrl]);

  const inactive =
    snapshot != null ? Math.max(0, Math.round(snapshot.usersTotal - snapshot.usersActive)) : 0;

  return (
    <div className="w-full space-y-7">
      <PageHeader
        title={t('dashboardOverviewTitle')}
        description={t('dashboardOverviewDescription')}
      />

      <AllServicesRetentionAlerts />

      {!authBackendBaseUrl ? <IdentityBackendMissing heading="h2" /> : null}

      {authBackendBaseUrl && !accessToken && (
        <Text className="text-sm text-muted-foreground">{t('dashboardNoSession')}</Text>
      )}

      {authBackendBaseUrl && accessToken ? (
        <section aria-labelledby="dashboard-identity-title">
          <ServiceSectionHeader
            id="dashboard-identity-title"
            title={t('dashboardIdentitySection')}
            service={t('dashboardEnvBadge')}
            link={{ to: '/users', label: t('dashboardIdentityLink') }}
          />
          {loading ? (
            <div className="space-y-3">
              <KpiSkeletonRow label={t('dashboardLoading')} />
              <KpiSkeletonRow
                columns={3}
                label={t('dashboardLoading')}
              />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : snapshot ? (
            <div className="space-y-3">
              <KpiRow label={t('dashboardKpiSection')}>
                <KpiCard
                  label={t('dashboardStatUsersTotal')}
                  value={formatInt(snapshot.usersTotal)}
                  hint={t('dashboardStatUsersTotalHint')}
                  icon={Users}
                />
                <KpiCard
                  label={t('dashboardStatUsersActive')}
                  value={formatInt(snapshot.usersActive)}
                  hint={t('dashboardStatUsersActiveHint', { inactive: formatInt(inactive) })}
                  icon={UserCheck}
                />
                <KpiCard
                  label={t('dashboardStatUsersStaff')}
                  value={formatInt(snapshot.usersStaff)}
                  hint={t('dashboardStatUsersStaffHint')}
                  icon={Shield}
                />
                <KpiCard
                  label={t('dashboardStatSocialLinks')}
                  value={formatInt(snapshot.socialAccountsTotal)}
                  hint={t('dashboardStatSocialLinksHint')}
                  icon={Link2}
                />
              </KpiRow>

              <KpiRow
                columns={3}
                label={t('dashboardActivitySection')}
              >
                <KpiCard
                  label={t('dashboardStatDau')}
                  value={formatInt(snapshot.dailyActiveUsers)}
                  hint={t('dashboardStatDauHint')}
                  icon={Calendar}
                />
                <KpiCard
                  label={t('dashboardStatWau')}
                  value={formatInt(snapshot.weeklyActiveUsers)}
                  hint={t('dashboardStatWauHint')}
                  icon={CalendarRange}
                />
                <KpiCard
                  label={t('dashboardStatMau')}
                  value={formatInt(snapshot.monthlyActiveUsers)}
                  hint={t('dashboardStatMauHint')}
                  icon={CalendarDays}
                />
              </KpiRow>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">{t('dashboardDescription')}</p>
        </section>
      ) : null}

      {accessToken && storageEnabled && (
        <section aria-labelledby="dashboard-storage-title">
          <ServiceSectionHeader
            id="dashboard-storage-title"
            title={t('dashboardStorageSection')}
            service={t('dashboardStorageBadge')}
            link={{ to: '/storage/statistics', label: t('dashboardStorageLink') }}
          />

          {storageLoading ? <KpiSkeletonRow label={t('dashboardStorageLoading')} /> : null}

          {storageError ? (
            <Alert variant="destructive">
              <AlertDescription>{storageError}</AlertDescription>
            </Alert>
          ) : null}

          {!storageLoading && !storageError && storageSnapshot && (
            <KpiRow label={t('dashboardStorageSection')}>
              <KpiCard
                label={t('dashboardStatStorageObjects')}
                value={formatInt(storageSnapshot.objectsTotal)}
                hint={t('dashboardStatStorageObjectsHint', {
                  size: formatBytes(storageSnapshot.bytesTotal),
                })}
                icon={HardDrive}
              />
              <KpiCard
                label={t('dashboardStatStorageDocuments')}
                value={formatInt(storageSnapshot.documentsTotal)}
                hint={t('dashboardStatStorageDocumentsHint', {
                  size: formatBytes(storageSnapshot.documentBytes),
                })}
                icon={FileText}
              />
              <KpiCard
                label={t('dashboardStatStorageQuota')}
                value={formatBytes(storageSnapshot.quotaUsedBytes)}
                hint={t('dashboardStatStorageQuotaHint', {
                  used: formatBytes(storageSnapshot.quotaUsedBytes),
                  max: formatBytes(storageSnapshot.quotaMaxBytes),
                })}
                icon={Gauge}
              />
              <KpiCard
                label={t('dashboardStatStorageUploads')}
                value={formatInt(storageSnapshot.uploads7d)}
                hint={t('dashboardStatStorageUploadsHint', {
                  today: formatInt(storageSnapshot.uploads24h),
                  size: formatBytes(storageSnapshot.bytes7d),
                })}
                icon={Upload}
              />
            </KpiRow>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t('dashboardStorageDescription')}</p>
        </section>
      )}

      {accessToken && hostingEnabled && (
        <section aria-labelledby="dashboard-hosting-title">
          <ServiceSectionHeader
            id="dashboard-hosting-title"
            title={t('dashboardHostingSection')}
            service={t('dashboardHostingBadge')}
            link={{ to: '/hosting', label: t('dashboardHostingLink') }}
          />

          {hostingLoading ? <KpiSkeletonRow label={t('dashboardHostingLoading')} /> : null}

          {hostingError ? (
            <Alert variant="destructive">
              <AlertDescription>{hostingError}</AlertDescription>
            </Alert>
          ) : null}

          {!hostingLoading && !hostingError && hostingSnapshot && (
            <KpiRow label={t('dashboardHostingSection')}>
              <KpiCard
                label={t('dashboardStatHostingApps')}
                value={formatInt(hostingSnapshot.appsTotal)}
                hint={t('dashboardStatHostingAppsHint', {
                  expired: formatInt(hostingSnapshot.appsExpired),
                })}
                icon={AppWindow}
              />
              <KpiCard
                label={t('dashboardStatHostingDeployments')}
                value={formatInt(hostingSnapshot.deploymentsTotal)}
                hint={t('dashboardStatHostingDeploymentsHint', {
                  active: formatInt(hostingSnapshot.activeDeployments),
                })}
                icon={Rocket}
              />
              <KpiCard
                label={t('dashboardStatHostingArtifacts')}
                value={formatBytes(hostingSnapshot.artifactBytes)}
                hint={t('dashboardStatHostingArtifactsHint')}
                icon={Package}
              />
              <KpiCard
                label={t('dashboardStatHostingDeploys')}
                value={formatInt(hostingSnapshot.deployments7d)}
                hint={t('dashboardStatHostingDeploysHint', {
                  today: formatInt(hostingSnapshot.deployments24h),
                })}
                icon={Upload}
              />
            </KpiRow>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t('dashboardHostingDescription')}</p>
        </section>
      )}

      <DashboardAiSection />

      <DashboardEmailSection />

      <p className="text-xs text-muted-foreground">{t('dashboardUiHint')}</p>
    </div>
  );
}
