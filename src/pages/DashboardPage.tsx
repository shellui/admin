import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ExternalLink,
  Link2,
  Loader2,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { buildStaffPrometheusMetricsUrl, fetchAuthMetricsSnapshot, type AuthMetricsSnapshot } from '@/lib/authMetricsApi';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

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
        <Icon className="size-4 text-muted-foreground" aria-hidden />
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

export function DashboardPage() {
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
      const msg = e instanceof Error ? e.message : t('dashboardError');
      if (msg === 'Forbidden' || /403/.test(msg)) {
        setError(t('dashboardForbidden'));
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

  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const metricsEndpointUrl = companyId != null ? buildStaffPrometheusMetricsUrl(companyId) : null;

  return (
    <div className="w-full space-y-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('dashboardTitle')}
          </h1>
          <Badge variant="secondary" className="font-mono text-[10px] uppercase">
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
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('dashboardLoading')}
        </div>
      )}

      {accessToken && error && (
        <Text className="font-mono text-sm text-destructive">{error}</Text>
      )}

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

          <div className="grid gap-6">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="font-heading text-lg">{t('dashboardExpositionTitle')}</CardTitle>
                <CardDescription className="font-mono text-xs">
                  {t('dashboardExpositionDescription')}
                </CardDescription>
                {metricsEndpointUrl && (
                  <div className="pt-2">
                    <a
                      href={metricsEndpointUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-primary underline-offset-4 hover:underline"
                    >
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                      {t('dashboardMetricsEndpointLink')}
                    </a>
                    <Text className="mt-1.5 block font-mono text-[10px] text-muted-foreground">
                      {t('dashboardMetricsEndpointHint')}
                    </Text>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {snapshot.rawText.trim()}
                </pre>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Separator className="bg-border" />

      <Text className="font-mono text-xs text-muted-foreground">{t('dashboardUiHint')}</Text>
    </div>
  );
}
