import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Link2,
  Loader2,
  RefreshCw,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react';
import { DashboardScheduledJobsSection } from '@/components/DashboardScheduledJobsSection';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { fetchAuthMetricsSnapshot, type AuthMetricsSnapshot } from '@/lib/authMetricsApi';

function StatBlock({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
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
        {hint ? <Text className="mt-1 font-mono text-xs">{hint}</Text> : null}
      </CardContent>
    </Card>
  );
}

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
    <div className="w-full space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              {t('identityStatsTitle')}
            </h1>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] uppercase"
            >
              {t('identityStatsBadge')}
            </Badge>
          </div>
          <Text className="max-w-3xl font-mono text-sm">{t('identityStatsDescription')}</Text>
          <Link
            to="/events"
            className="inline-flex font-mono text-xs text-primary underline-offset-4 hover:underline"
          >
            {t('identityStatsOpenEvents')}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          disabled={loading}
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('identityStatsRefresh')}
        </button>
      </header>

      {!accessToken && (
        <Text className="font-mono text-sm text-muted-foreground">
          {t('identityStatsNoSession')}
        </Text>
      )}

      {accessToken && loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('identityStatsLoading')}
        </div>
      )}

      {error && (
        <Text
          role="alert"
          className="font-mono text-sm text-destructive"
        >
          {error}
        </Text>
      )}

      {snapshot && !loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatBlock
              label={t('identityStatsUsers')}
              value={formatInt(snapshot.usersTotal)}
              hint={t('identityStatsUsersHint')}
              icon={Users}
            />
            <StatBlock
              label={t('identityStatsActive')}
              value={formatInt(snapshot.usersActive)}
              hint={t('identityStatsActiveHint', { inactive: formatInt(inactive) })}
              icon={UserCheck}
            />
            <StatBlock
              label={t('identityStatsStaff')}
              value={formatInt(snapshot.usersStaff)}
              hint={t('identityStatsStaffHint')}
              icon={Shield}
            />
            <StatBlock
              label={t('identityStatsSocial')}
              value={formatInt(snapshot.socialAccountsTotal)}
              hint={t('identityStatsSocialHint')}
              icon={Link2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatBlock
              label={t('identityStatsDaily')}
              value={formatInt(snapshot.dailyActiveUsers)}
              hint={t('identityStatsDailyHint')}
              icon={Calendar}
            />
            <StatBlock
              label={t('identityStatsWeekly')}
              value={formatInt(snapshot.weeklyActiveUsers)}
              hint={t('identityStatsWeeklyHint')}
              icon={CalendarRange}
            />
            <StatBlock
              label={t('identityStatsMonthly')}
              value={formatInt(snapshot.monthlyActiveUsers)}
              hint={t('identityStatsMonthlyHint')}
              icon={CalendarDays}
            />
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t('identityStatsLoginsTitle')}</CardTitle>
              <CardDescription>{t('identityStatsLoginsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {snapshot.successfulLogins.length === 0 ? (
                <Text className="text-sm text-muted-foreground">
                  {t('identityStatsLoginsEmpty')}
                </Text>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-1.5 font-medium">{t('identityStatsColProvider')}</th>
                      <th className="py-1.5 font-medium">{t('identityStatsColCount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.successfulLogins.map((row) => (
                      <tr
                        key={row.provider}
                        className="border-b border-border/60"
                      >
                        <td className="py-1.5 font-mono text-xs">{row.provider}</td>
                        <td className="py-1.5 font-mono tabular-nums">{formatInt(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <DashboardScheduledJobsSection service="identity" />
    </div>
  );
}
