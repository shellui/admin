import { KpiCard, KpiRow, KpiSkeletonRow, ServiceSectionHeader } from '@/components/admin/Kpi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Mail, MailCheck, MailWarning, MailX, ShieldAlert } from 'lucide-react';
import { useEmailAdminEnabled, useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { loadEmailDashboardSnapshot, type EmailDashboardQuiet } from '@/lib/dashboardEmail';
import type { EmailStats } from '@/lib/emailTypes';

function formatInt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

function quietMessage(t: (key: string) => string, quiet: EmailDashboardQuiet): string {
  return quiet === 'no_provider' ? t('dashboardEmailNoProvider') : t('dashboardEmailUnavailable');
}

function DashboardEmailQuiet({ quiet }: { quiet: EmailDashboardQuiet }) {
  const { t } = useTranslation();
  return (
    <Alert variant="info">
      <AlertDescription>{quietMessage(t, quiet)}</AlertDescription>
    </Alert>
  );
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
    <section aria-labelledby="dashboard-email-title">
      <ServiceSectionHeader
        id="dashboard-email-title"
        title={t('dashboardEmailSection')}
        service={t('dashboardEmailBadge')}
        link={{ to: '/email/statistics', label: t('dashboardEmailOpen') }}
      />
      {loading ? (
        <KpiSkeletonRow
          columns={6}
          label={t('dashboardEmailLoading')}
        />
      ) : null}

      {!loading && quiet ? <DashboardEmailQuiet quiet={quiet} /> : null}

      {!loading && !quiet && totals ? (
        <KpiRow
          columns={6}
          label={t('dashboardEmailSection')}
        >
          <KpiCard
            label={t('dashboardStatEmailSent')}
            value={formatInt(totals.sent)}
            hint={t('dashboardStatEmailSentHint')}
            icon={Mail}
          />
          <KpiCard
            label={t('dashboardStatEmailDelivered')}
            value={formatInt(totals.delivered)}
            hint={t('dashboardStatEmailDeliveredHint')}
            icon={MailCheck}
          />
          <KpiCard
            label={t('dashboardStatEmailBounced')}
            value={formatInt(totals.bounced)}
            hint={t('dashboardStatEmailBouncedHint')}
            icon={MailWarning}
          />
          <KpiCard
            label={t('dashboardStatEmailFailed')}
            value={formatInt(totals.failed)}
            hint={t('dashboardStatEmailFailedHint')}
            icon={MailX}
          />
          <KpiCard
            label={t('dashboardStatEmailComplaints')}
            value={formatInt(totals.complained)}
            hint={t('dashboardStatEmailComplaintsHint')}
            icon={ShieldAlert}
          />
          <KpiCard
            label={t('dashboardStatEmailSuppressed')}
            value={formatInt(totals.suppressed)}
            hint={t('dashboardStatEmailSuppressedHint')}
            icon={Ban}
          />
        </KpiRow>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {t('dashboardEmailDescription')}
        {stats ? ` ${t('emailStatsWindow', { from: stats.from, to: stats.to })}` : ''}
      </p>
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
