import {
  AI_CALL_LOG_WINDOW_MS,
  countAgentsByDisplayStatus,
  countFailedCallLogs,
  filterCallLogsSince,
  type AiAgentStatusCounts,
} from '@/lib/aiStatusStats';
import {
  fetchCompanyMcpAgents,
  fetchCompanyMcpApprovals,
  fetchCompanyMcpCallLogs,
  type CompanyMcpAgent,
  type CompanyMcpCallLogEntry,
} from '@/lib/companyAgentsApi';

export type AiDashboardQuiet = 'unavailable';

export type AiDashboardMetrics = {
  agentCounts: AiAgentStatusCounts;
  pendingApprovals: number;
  callLogs24h: number;
  callLogErrors24h: number;
};

export type AiDashboardSnapshot =
  { metrics: AiDashboardMetrics; quiet: null } | { metrics: null; quiet: AiDashboardQuiet };

/** Build dashboard KPI totals from already-fetched MCP data. */
export function buildAiDashboardMetricsFromSources(
  agents: CompanyMcpAgent[],
  approvals: unknown[],
  callLogs: CompanyMcpCallLogEntry[],
): AiDashboardMetrics {
  const recent = filterCallLogsSince(callLogs, AI_CALL_LOG_WINDOW_MS);
  return {
    agentCounts: countAgentsByDisplayStatus(agents),
    pendingApprovals: approvals.length,
    callLogs24h: recent.length,
    callLogErrors24h: countFailedCallLogs(recent),
  };
}

/** Shared MCP activity totals for Dashboard and AI Status. */
export async function fetchAiDashboardMetrics(
  accessToken: string,
  companyId: number,
): Promise<AiDashboardMetrics> {
  const [agents, approvals, callLogs] = await Promise.all([
    fetchCompanyMcpAgents(accessToken, companyId),
    fetchCompanyMcpApprovals(accessToken, companyId),
    fetchCompanyMcpCallLogs(accessToken, companyId),
  ]);
  return buildAiDashboardMetricsFromSources(agents, approvals, callLogs);
}

/**
 * Load dashboard AI KPIs from company MCP agents, approvals, and call logs.
 * Unreachable MCP APIs become a quiet empty state. This function does not throw.
 */
export async function loadAiDashboardSnapshot(
  accessToken: string,
  companyId: number,
): Promise<AiDashboardSnapshot> {
  try {
    return { metrics: await fetchAiDashboardMetrics(accessToken, companyId), quiet: null };
  } catch {
    return { metrics: null, quiet: 'unavailable' };
  }
}
