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
  MCP_CALL_LOG_MAX_LIMIT,
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

/**
 * Call-log totals for a window from ai-service.
 * `total` is the API `count` (every matching row). `failed` counts status
 * `failed` and `error`. When the first page is the full window, failures are
 * counted from those rows. Otherwise two filtered counts cover the rest.
 */
export async function fetchMcpCallLogWindow(
  accessToken: string,
  companyId: number,
  createdAfter: string,
): Promise<{ total: number; failed: number; logs: CompanyMcpCallLogEntry[] }> {
  const page = await fetchCompanyMcpCallLogs(accessToken, companyId, {
    createdAfter,
    limit: MCP_CALL_LOG_MAX_LIMIT,
  });
  let failed = countFailedCallLogs(page.call_logs);
  if (page.count > page.call_logs.length) {
    const [failedPage, errorPage] = await Promise.all([
      fetchCompanyMcpCallLogs(accessToken, companyId, {
        createdAfter,
        status: 'failed',
        limit: 1,
      }),
      fetchCompanyMcpCallLogs(accessToken, companyId, {
        createdAfter,
        status: 'error',
        limit: 1,
      }),
    ]);
    failed = failedPage.count + errorPage.count;
  }
  return { total: page.count, failed, logs: page.call_logs };
}

/** Shared MCP activity totals for Dashboard and AI Status. */
export async function fetchAiDashboardMetrics(
  accessToken: string,
  companyId: number,
): Promise<AiDashboardMetrics> {
  const createdAfter = new Date(Date.now() - AI_CALL_LOG_WINDOW_MS).toISOString();
  const [agents, approvals, callWindow] = await Promise.all([
    fetchCompanyMcpAgents(accessToken, companyId),
    fetchCompanyMcpApprovals(accessToken, companyId),
    fetchMcpCallLogWindow(accessToken, companyId, createdAfter),
  ]);
  const metrics = buildAiDashboardMetricsFromSources(agents, approvals, callWindow.logs);
  return {
    ...metrics,
    callLogs24h: callWindow.total,
    callLogErrors24h: callWindow.failed,
  };
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
