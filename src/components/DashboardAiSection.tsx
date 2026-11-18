import { Component, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Clock, ShieldAlert, Wrench } from 'lucide-react';
import { KpiCard, KpiRow, KpiSkeletonRow, ServiceSectionHeader } from '@/components/admin/Kpi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Text } from '@/components/ui/text';
import { isAiAdminEnabled } from '@/lib/aiServiceUrl';
import {
  loadAiDashboardSnapshot,
  type AiDashboardMetrics,
  type AiDashboardQuiet,
} from '@/lib/dashboardAi';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { useShelluiAiService } from '@/hooks/useShelluiAiService';

function formatInt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

function DashboardAiQuiet() {
  const { t } = useTranslation();
  return (
    <Alert variant="info">
      <AlertDescription>{t('dashboardAiUnavailable')}</AlertDescription>
    </Alert>
  );
}

class DashboardAiBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <DashboardAiQuiet />;
    return this.props.children;
  }
}

function DashboardAiSectionInner() {
  const { t } = useTranslation();
  const aiSettings = useShelluiAiService();
  const enabled = isAiAdminEnabled(aiSettings);
  const accessToken = useShelluiAccessToken();
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<AiDashboardMetrics | null>(null);
  const [quiet, setQuiet] = useState<AiDashboardQuiet | null>(null);

  useEffect(() => {
    if (!enabled || !accessToken || companyId == null) {
      setLoading(false);
      setMetrics(null);
      setQuiet(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setQuiet(null);
    void loadAiDashboardSnapshot(accessToken, companyId).then((result) => {
      if (cancelled) return;
      setMetrics(result.metrics);
      setQuiet(result.quiet);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, companyId, enabled]);

  if (!enabled || !accessToken) return null;

  const activeHint =
    metrics && metrics.agentCounts.revoked > 0
      ? t('dashboardStatAiAgentsActiveHintRevoked', {
          count: metrics.agentCounts.revoked,
        })
      : t('dashboardStatAiAgentsActiveHintConnected');

  return (
    <section aria-labelledby="dashboard-ai-title">
      <ServiceSectionHeader
        id="dashboard-ai-title"
        title={t('dashboardAiSection')}
        service={t('dashboardAiBadge')}
        link={{ to: '/ai', label: t('dashboardAiOpen') }}
      />
      {companyId == null && !loading ? (
        <Text className="text-sm text-muted-foreground">{t('dashboardNoSession')}</Text>
      ) : null}

      {companyId != null && loading ? (
        <KpiSkeletonRow
          columns={4}
          label={t('dashboardAiLoading')}
        />
      ) : null}

      {companyId != null && !loading && quiet ? <DashboardAiQuiet /> : null}

      {companyId != null && !loading && !quiet && metrics ? (
        <KpiRow
          columns={4}
          label={t('dashboardAiSection')}
        >
          <KpiCard
            label={t('dashboardStatAiAgentsActive')}
            value={formatInt(metrics.agentCounts.active)}
            hint={activeHint}
            icon={Bot}
          />
          <KpiCard
            label={t('dashboardStatAiPendingApprovals')}
            value={formatInt(metrics.pendingApprovals)}
            hint={t('dashboardStatAiPendingApprovalsHint')}
            icon={Clock}
          />
          <KpiCard
            label={t('dashboardStatAiCalls24h')}
            value={formatInt(metrics.callLogs24h)}
            hint={t('dashboardStatAiCalls24hHint')}
            icon={Wrench}
          />
          <KpiCard
            label={t('dashboardStatAiFailed24h')}
            value={formatInt(metrics.callLogErrors24h)}
            hint={t('dashboardStatAiFailed24hHint')}
            icon={ShieldAlert}
          />
        </KpiRow>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">{t('dashboardAiDescription')}</p>
    </section>
  );
}

export function DashboardAiSection() {
  return (
    <DashboardAiBoundary>
      <DashboardAiSectionInner />
    </DashboardAiBoundary>
  );
}
