import {
  agentDisplayStatus,
  isFailedMcpCallLog,
  type CompanyMcpAgent,
  type CompanyMcpCallLogEntry,
} from '@/lib/companyAgentsApi';

/** Default call-log window for AI activity KPIs (24 hours). */
export const AI_CALL_LOG_WINDOW_MS = 24 * 60 * 60 * 1000;

export type AiAgentStatusCounts = {
  active: number;
  paused: number;
  revoked: number;
  expired: number;
};

export function countAgentsByDisplayStatus(agents: CompanyMcpAgent[]): AiAgentStatusCounts {
  const counts: AiAgentStatusCounts = { active: 0, paused: 0, revoked: 0, expired: 0 };
  for (const agent of agents) {
    counts[agentDisplayStatus(agent)] += 1;
  }
  return counts;
}

export function filterCallLogsSince(
  logs: CompanyMcpCallLogEntry[],
  sinceMs: number,
  nowMs = Date.now(),
): CompanyMcpCallLogEntry[] {
  const cutoff = nowMs - sinceMs;
  return logs.filter((entry) => {
    const t = new Date(entry.created_at).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
}

export function countFailedCallLogs(logs: CompanyMcpCallLogEntry[]): number {
  return logs.filter((entry) => isFailedMcpCallLog(entry)).length;
}

export function topToolsFromCallLogs(
  logs: CompanyMcpCallLogEntry[],
  limit = 5,
): Array<{ tool: string; count: number }> {
  const byTool = new Map<string, number>();
  for (const entry of logs) {
    const key = entry.tool_name.trim() || '-';
    byTool.set(key, (byTool.get(key) ?? 0) + 1);
  }
  return [...byTool.entries()]
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count || a.tool.localeCompare(b.tool))
    .slice(0, limit);
}
