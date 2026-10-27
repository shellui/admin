import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Link2,
  RefreshCw,
  ScrollText,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react';
import { DashboardScheduledJobsSection } from '@/components/DashboardScheduledJobsSection';
import { KpiCard, KpiRow, KpiSkeletonRow } from '@/components/admin/Kpi';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatTableCard } from '@/components/admin/StatsParts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { fetchAuthMetricsSnapshot, type AuthMetricsSnapshot } from '@/lib/authMetricsApi';
import { cn } from '@/lib/utils';

function formatInt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function IdentityStatisticsPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const [snapshot, setSnapshot] = useState<AuthMetricsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setSnapshot(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchAuthMetricsSnapshot(accessToken));
    } catch (e) {
      setSnapshot(null);
      const msg = e instanceof Error ? e.message : t('identityStatsError');
      if (msg === 'Forbidden' || /403/.test(msg)) {
        setError(t('identityStatsForbidden'));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const inactive =
    snapshot != null ? Math.max(0, Math.round(snapshot.usersTotal - snapshot.usersActive)) : 0;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('identityStatsTitle')}
        service={t('identityStatsBadge')}
        description={t('identityStatsDescription')}
        actions={
          <>
            <Button
              asChild
              variant="ghost"
              size="sm"
            >
              <Link to="/events">
                <ScrollText
                  aria-hidden
                  className="mr-1.5 size-3.5"
                />
                {t('identityStatsOpenEvents')}
              </Link>
            </Button>
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
              {t('identityStatsRefresh')}
            </Button>
          </>
        }
      />

      {!accessToken && (
        <Alert variant="info">
          <AlertDescription>{t('identityStatsNoSession')}</AlertDescription>
        </Alert>
      )}

      {accessToken && loading && (
        <div className="space-y-4">
          <KpiSkeletonRow label={t('identityStatsLoading')} />
          <KpiSkeletonRow
            columns={3}
            label={t('identityStatsLoading')}
          />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {snapshot && !loading && (
        <>
          <KpiRow label={t('identityStatsTitle')}>
            <KpiCard
              label={t('identityStatsUsers')}
              value={formatInt(snapshot.usersTotal)}
              hint={t('identityStatsUsersHint')}
              icon={Users}
            />
            <KpiCard
              label={t('identityStatsActive')}
              value={formatInt(snapshot.usersActive)}
              hint={t('identityStatsActiveHint', { inactive: formatInt(inactive) })}
              icon={UserCheck}
            />
            <KpiCard
              label={t('identityStatsStaff')}
              value={formatInt(snapshot.usersStaff)}
              hint={t('identityStatsStaffHint')}
              icon={Shield}
            />
            <KpiCard
              label={t('identityStatsSocial')}
              value={formatInt(snapshot.socialAccountsTotal)}
              hint={t('identityStatsSocialHint')}
              icon={Link2}
            />
          </KpiRow>

          <KpiRow
            columns={3}
            label={t('identityStatsMonthly')}
          >
            <KpiCard
              label={t('identityStatsDaily')}
              value={formatInt(snapshot.dailyActiveUsers)}
              hint={t('identityStatsDailyHint')}
              icon={Calendar}
            />
            <KpiCard
              label={t('identityStatsWeekly')}
              value={formatInt(snapshot.weeklyActiveUsers)}
              hint={t('identityStatsWeeklyHint')}
              icon={CalendarRange}
            />
            <KpiCard
              label={t('identityStatsMonthly')}
              value={formatInt(snapshot.monthlyActiveUsers)}
              hint={t('identityStatsMonthlyHint')}
              icon={CalendarDays}
            />
          </KpiRow>

          <StatTableCard
            title={t('identityStatsLoginsTitle')}
            description={t('identityStatsLoginsDescription')}
            columns={[
              { label: t('identityStatsColProvider') },
              { label: t('identityStatsColCount'), className: 'text-right' },
            ]}
            rows={snapshot.successfulLogins.map((row) => ({
              key: row.provider,
              cells: [
                <span className="font-mono text-xs">{row.provider}</span>,
                <span className="tabular-nums">{formatInt(row.total)}</span>,
              ],
            }))}
            empty={t('identityStatsLoginsEmpty')}
          />
        </>
      )}

      <DashboardScheduledJobsSection service="identity" />
    </div>
  );
}
