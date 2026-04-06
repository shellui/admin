import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Link2,
  Loader2,
  LogIn,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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

function LoginMixPanel({ snapshot }: { snapshot: AuthMetricsSnapshot }) {
  const { t } = useTranslation();
  const rows = snapshot.loginsByProvider;
  const max = rows.length ? Math.max(...rows.map((r) => r.count), 1) : 1;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/15 p-6">
        <Text className="font-mono text-xs text-muted-foreground">{t('dashboardLoginsEmpty')}</Text>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.provider} className="space-y-1">
          <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span className="uppercase tracking-wider">{r.provider}</span>
            <span className="tabular-nums">{formatInt(r.count)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded bg-primary/60"
              style={{ width: `${Math.min(100, (r.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
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

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="border-border/80 lg:col-span-3">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2 text-lg">
                  <LogIn className="size-4 text-muted-foreground" aria-hidden />
                  {t('dashboardLoginsTitle')}
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  {t('dashboardLoginsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Text className="font-mono text-xs text-muted-foreground">
                    {t('dashboardLoginsTotalLabel')}
                  </Text>
                  <span className="font-mono text-xl font-semibold tabular-nums">
                    {formatInt(snapshot.loginsSinceProcessStart)}
                  </span>
                </div>
                <LoginMixPanel snapshot={snapshot} />
                <Text className="font-mono text-[10px] text-muted-foreground">
                  {t('dashboardLoginsProcessNote')}
                </Text>
              </CardContent>
            </Card>

            <Card className="border-border/80 lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-heading text-lg">{t('dashboardExpositionTitle')}</CardTitle>
                <CardDescription className="font-mono text-xs">
                  {t('dashboardExpositionDescription')}
                </CardDescription>
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
