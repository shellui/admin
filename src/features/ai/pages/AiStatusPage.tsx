import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  ChevronRight,
  Clock,
  PauseCircle,
  RefreshCw,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { KpiCard, KpiRow, KpiSkeletonRow } from '@/components/admin/Kpi';
import { SettingsSection } from '@/components/admin/SettingsSection';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { StatTableCard } from '@/components/admin/StatsParts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { isAiAdminEnabled } from '@/lib/aiServiceUrl';
import {
  AI_CALL_LOG_WINDOW_MS,
  filterCallLogsSince,
  topToolsFromCallLogs,
} from '@/lib/aiStatusStats';
import { buildAiDashboardMetricsFromSources } from '@/lib/dashboardAi';
import {
  fetchCompanyMcpAgents,
  fetchCompanyMcpApprovals,
  fetchCompanyMcpCallLogs,
  isMcpApiUnavailable,
} from '@/lib/companyAgentsApi';
import { aiServiceMcpEndpointUrl } from '@/lib/companyAgentsMcpConfig';
import { useShelluiAiService } from '@/hooks/useShelluiAiService';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';
import { cn } from '@/lib/utils';

function formatInt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

type McpReachability = 'ok' | 'unavailable' | 'missing_session';

export function AiStatusPage() {
  const { t } = useTranslation();
  const aiSettings = useShelluiAiService();
  const aiUrl = isAiAdminEnabled(aiSettings) ? (aiSettings?.url ?? null) : null;
  const accessToken = useShelluiAccessToken();
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const mcpEndpoint = aiUrl ? aiServiceMcpEndpointUrl(aiUrl, companyId) : '';

  const [mcpReachability, setMcpReachability] = useState<McpReachability>('missing_session');
  const [agentCounts, setAgentCounts] = useState<
    ReturnType<typeof buildAiDashboardMetricsFromSources>['agentCounts'] | null
  >(null);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);
  const [callLogs24h, setCallLogs24h] = useState<number | null>(null);
  const [callLogErrors24h, setCallLogErrors24h] = useState<number | null>(null);
  const [topTools, setTopTools] = useState<Array<{ tool: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!aiUrl) return;
    if (!accessToken || companyId == null) {
      setMcpReachability('missing_session');
      setAgentCounts(null);
      setPendingApprovals(null);
      setCallLogs24h(null);
      setCallLogErrors24h(null);
      setTopTools([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [agents, approvals, callLogs] = await Promise.all([
        fetchCompanyMcpAgents(accessToken, companyId),
        fetchCompanyMcpApprovals(accessToken, companyId),
        fetchCompanyMcpCallLogs(accessToken, companyId),
      ]);
      const dashboardMetrics = buildAiDashboardMetricsFromSources(agents, approvals, callLogs);
      setMcpReachability('ok');
      setAgentCounts(dashboardMetrics.agentCounts);
      setPendingApprovals(dashboardMetrics.pendingApprovals);
      setCallLogs24h(dashboardMetrics.callLogs24h);
      setCallLogErrors24h(dashboardMetrics.callLogErrors24h);
      const recent = filterCallLogsSince(callLogs, AI_CALL_LOG_WINDOW_MS);
      setTopTools(topToolsFromCallLogs(recent));
    } catch (e) {
      if (isMcpApiUnavailable(e)) {
        setMcpReachability('unavailable');
        setError(t('aiStatusMcpUnavailableDetail'));
      } else {
        setMcpReachability('unavailable');
        setError(e instanceof Error ? e.message : t('aiStatusLoadError'));
      }
      setAgentCounts(null);
      setPendingApprovals(null);
      setCallLogs24h(null);
      setCallLogErrors24h(null);
      setTopTools([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, aiUrl, companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const statsReady = useMemo(
    () => agentCounts != null && pendingApprovals != null && callLogs24h != null,
    [agentCounts, callLogs24h, pendingApprovals],
  );

  if (!aiUrl) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={t('aiStatusTitle')}
          service={t('navAiGroup')}
        />
        <Alert>
          <AlertTitle>{t('aiMissingTitle')}</AlertTitle>
          <AlertDescription>{t('agentsConnectMissingUrl')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('aiStatusTitle')}
        service={t('navAiGroup')}
        description={t('aiStatusDescription')}
        actions={
          <>
            <Button
              asChild
              variant="ghost"
              size="sm"
            >
              <Link to="/agents">
                {t('aiStatusOpenAgents')}
                <ChevronRight
                  className="ml-0.5 size-3.5"
                  aria-hidden
                />
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || !accessToken || companyId == null}
              onClick={() => void load()}
            >
              <RefreshCw
                aria-hidden
                className={cn(
                  'mr-1.5 size-3.5',
                  loading && 'animate-spin motion-reduce:animate-none',
                )}
              />
              {t('aiStatusRefresh')}
            </Button>
          </>
        }
      />

      {error ? (
        <Alert variant={mcpReachability === 'unavailable' ? 'default' : 'destructive'}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <SettingsSection
        id="ai-status-connection"
        title={t('aiStatusSectionTitle')}
        description={aiUrl}
      >
        <dl className="grid gap-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-muted-foreground">{t('aiStatusMcpLabel')}</dt>
            <dd>
              {loading && mcpReachability === 'missing_session' ? (
                <span className="text-muted-foreground">{t('aiStatusLoading')}</span>
              ) : mcpReachability === 'missing_session' ? (
                <span className="text-muted-foreground">{t('aiStatusMcpSignIn')}</span>
              ) : (
                <StatusBadge tone={mcpReachability === 'ok' ? 'success' : 'warning'}>
                  {mcpReachability === 'ok' ? t('aiStatusMcpOk') : t('aiStatusMcpUnreachable')}
                </StatusBadge>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{t('agentsConnectTitle')}</dt>
            <dd className="break-all font-mono text-xs text-foreground">{mcpEndpoint || '-'}</dd>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('aiStatusMcpNote')}</p>
          </div>
        </dl>
      </SettingsSection>

      <SettingsSection
        id="ai-status-activity"
        title={t('aiStatusStatsSectionTitle')}
        description={t('aiStatusStatsSectionDescription')}
      >
        {loading && !statsReady ? (
          <KpiSkeletonRow
            columns={4}
            label={t('aiStatusLoading')}
          />
        ) : !accessToken || companyId == null ? (
          <p className="text-sm text-muted-foreground">{t('aiStatusMcpSignIn')}</p>
        ) : statsReady && agentCounts ? (
          <div className="space-y-6">
            <KpiRow
              columns={4}
              label={t('aiStatusStatsSectionTitle')}
            >
              <KpiCard
                icon={Bot}
                label={t('aiStatusAgentsActive')}
                value={formatInt(agentCounts.active)}
              />
              <KpiCard
                icon={PauseCircle}
                label={t('aiStatusAgentsPaused')}
                value={formatInt(agentCounts.paused)}
              />
              <KpiCard
                icon={ShieldAlert}
                label={t('aiStatusAgentsRevoked')}
                value={formatInt(agentCounts.revoked)}
              />
              <KpiCard
                icon={Clock}
                label={t('aiStatusPendingApprovals')}
                value={formatInt(pendingApprovals ?? 0)}
              />
            </KpiRow>
            <KpiRow
              columns={4}
              label={t('aiStatusCallMetricsRow')}
            >
              <KpiCard
                icon={Wrench}
                label={t('aiStatusCallLogs24h')}
                value={formatInt(callLogs24h ?? 0)}
                hint={t('aiStatusCallLogs24hHint')}
              />
              <KpiCard
                icon={ShieldAlert}
                label={t('aiStatusCallLogErrors24h')}
                value={formatInt(callLogErrors24h ?? 0)}
                hint={t('aiStatusCallLogErrors24hHint')}
              />
            </KpiRow>
            <StatTableCard
              title={t('aiStatusTopTools')}
              columns={[
                { label: t('aiStatusTopToolsColumn') },
                { label: t('aiStatusTopToolsCountColumn'), className: 'text-right' },
              ]}
              rows={topTools.map((row) => ({
                key: row.tool,
                cells: [
                  <span className="font-mono text-xs">{row.tool}</span>,
                  <span className="tabular-nums">{formatInt(row.count)}</span>,
                ],
              }))}
              empty={t('aiStatusTopToolsEmpty')}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('aiStatusStatsUnavailable')}</p>
        )}
      </SettingsSection>
    </div>
  );
}
