import { describe, expect, it, vi } from 'vitest';
import { buildAiDashboardMetricsFromSources, loadAiDashboardSnapshot } from '@/lib/dashboardAi';
import type { CompanyMcpAgent, CompanyMcpCallLogEntry } from '@/lib/companyAgentsApi';

const agent: CompanyMcpAgent = {
  id: '1',
  name: 'Agent',
  access_mode: 'ask',
  read_level: 'safe',
  allow_destructive_without_asking: false,
  services_allowed: [],
  project_scope: '',
  expires_at: null,
  paused_at: null,
  revoked_at: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

vi.mock('@/lib/companyAgentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/companyAgentsApi')>();
  return {
    ...actual,
    fetchCompanyMcpAgents: vi.fn(async () => [agent]),
    fetchCompanyMcpApprovals: vi.fn(async () => [{ id: 'p1' }]),
    fetchCompanyMcpCallLogs: vi.fn(async () => [
      {
        id: 1,
        agent_id: '1',
        agent_name: 'Agent',
        service: 'storage',
        tool: 'list_files',
        method: 'GET',
        path: '/files',
        status_code: 200,
        duration_ms: 12,
        arguments: {},
        created_at: new Date().toISOString(),
      } satisfies CompanyMcpCallLogEntry,
    ]),
  };
});

describe('loadAiDashboardSnapshot', () => {
  it('returns MCP activity totals when APIs succeed', async () => {
    const snapshot = await loadAiDashboardSnapshot('token', 42);
    expect(snapshot.quiet).toBeNull();
    expect(snapshot.metrics?.agentCounts.active).toBe(1);
    expect(snapshot.metrics?.pendingApprovals).toBe(1);
    expect(snapshot.metrics?.callLogs24h).toBe(1);
    expect(snapshot.metrics?.callLogErrors24h).toBe(0);
  });

  it('stays quiet when MCP APIs fail and does not throw', async () => {
    const { fetchCompanyMcpAgents } = await import('@/lib/companyAgentsApi');
    vi.mocked(fetchCompanyMcpAgents).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const snapshot = await loadAiDashboardSnapshot('token', 42);
    expect(snapshot).toEqual({ metrics: null, quiet: 'unavailable' });
  });
});

describe('buildAiDashboardMetricsFromSources', () => {
  it('counts failed calls in the 24h window', () => {
    const now = Date.now();
    const metrics = buildAiDashboardMetricsFromSources(
      [agent],
      [{ id: 'p1' }, { id: 'p2' }],
      [
        {
          id: 1,
          agent_id: '1',
          agent_name: 'Agent',
          service: 'storage',
          tool: 'list_files',
          method: 'GET',
          path: '/files',
          status_code: 500,
          duration_ms: 12,
          arguments: {},
          created_at: new Date(now).toISOString(),
        },
      ],
    );
    expect(metrics.pendingApprovals).toBe(2);
    expect(metrics.callLogs24h).toBe(1);
    expect(metrics.callLogErrors24h).toBe(1);
  });
});
