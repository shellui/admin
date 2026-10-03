import { Component, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Ban, Loader2, Mail, MailCheck, MailWarning, MailX, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useEmailAdminEnabled, useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { loadEmailDashboardSnapshot, type EmailDashboardQuiet } from '@/lib/dashboardEmail';
import type { EmailStats } from '@/lib/emailTypes';

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

function quietMessage(t: (key: string) => string, quiet: EmailDashboardQuiet): string {
  return quiet === 'no_provider' ? t('dashboardEmailNoProvider') : t('dashboardEmailUnavailable');
}

function DashboardEmailQuiet({ quiet }: { quiet: EmailDashboardQuiet }) {
  const { t } = useTranslation();
  return <Text className="font-mono text-sm text-muted-foreground">{quietMessage(t, quiet)}</Text>;
}

class DashboardEmailBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <DashboardEmailQuiet quiet="unavailable" />;
    return this.props.children;
  }
}

function DashboardEmailSectionInner() {
  const { t } = useTranslation();
  const enabled = useEmailAdminEnabled();
  const accessToken = useShelluiAccessToken();
  const { api } = useEmailApi(accessToken);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [quiet, setQuiet] = useState<EmailDashboardQuiet | null>(null);

  useEffect(() => {
    if (!enabled || !accessToken || !api) {
      setLoading(false);
      setStats(null);
      setQuiet(enabled && accessToken && !api ? 'unavailable' : null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setQuiet(null);
    void loadEmailDashboardSnapshot(api).then((result) => {
      if (cancelled) return;
      setStats(result.stats);
      setQuiet(result.quiet);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, api, enabled]);

  if (!enabled || !accessToken) return null;

  const totals = stats?.totals;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          {t('dashboardEmailSection')}
        </h2>
        <Badge
          variant="secondary"
          className="font-mono text-[10px] uppercase"
        >
          {t('dashboardEmailBadge')}
        </Badge>
      </div>
      <Text className="max-w-3xl font-mono text-sm">{t('dashboardEmailDescription')}</Text>
      {stats ? (
        <Text className="font-mono text-xs">
          {t('emailStatsWindow', { from: stats.from, to: stats.to })}
        </Text>
      ) : null}
      <Link
        to="/email/statistics"
        className="inline-flex items-center gap-1.5 font-mono text-xs text-primary underline-offset-4 hover:underline"
      >
        {t('dashboardEmailOpen')}
      </Link>

      {loading ? (
        <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
          <Loader2
            className="size-4 animate-spin"
            aria-hidden
          />
          {t('dashboardEmailLoading')}
        </div>
      ) : null}

      {!loading && quiet ? <DashboardEmailQuiet quiet={quiet} /> : null}

      {!loading && !quiet && totals ? (
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label={t('dashboardEmailSection')}
        >
          <StatBlock
            label={t('dashboardStatEmailSent')}
            value={formatInt(totals.sent)}
            hint={t('dashboardStatEmailSentHint')}
            icon={Mail}
          />
          <StatBlock
            label={t('dashboardStatEmailDelivered')}
            value={formatInt(totals.delivered)}
            hint={t('dashboardStatEmailDeliveredHint')}
            icon={MailCheck}
          />
          <StatBlock
            label={t('dashboardStatEmailBounced')}
            value={formatInt(totals.bounced)}
            hint={t('dashboardStatEmailBouncedHint')}
            icon={MailWarning}
          />
          <StatBlock
            label={t('dashboardStatEmailFailed')}
            value={formatInt(totals.failed)}
            hint={t('dashboardStatEmailFailedHint')}
            icon={MailX}
          />
          <StatBlock
            label={t('dashboardStatEmailComplaints')}
            value={formatInt(totals.complained)}
            hint={t('dashboardStatEmailComplaintsHint')}
            icon={ShieldAlert}
          />
          <StatBlock
            label={t('dashboardStatEmailSuppressed')}
            value={formatInt(totals.suppressed)}
            hint={t('dashboardStatEmailSuppressedHint')}
            icon={Ban}
          />
        </div>
      ) : null}
    </section>
  );
}

export function DashboardEmailSection() {
  return (
    <DashboardEmailBoundary>
      <DashboardEmailSectionInner />
    </DashboardEmailBoundary>
  );
}
