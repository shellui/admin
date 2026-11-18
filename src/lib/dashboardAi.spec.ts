import { describe, expect, it, vi } from 'vitest';
import { buildAiDashboardMetricsFromSources, loadAiDashboardSnapshot } from '@/lib/dashboardAi';
import type { CompanyMcpAgent, CompanyMcpCallLogEntry } from '@/lib/companyAgentsApi';

function callLog(
  partial: Partial<CompanyMcpCallLogEntry> &
    Pick<CompanyMcpCallLogEntry, 'id' | 'created_at' | 'status'>,
): CompanyMcpCallLogEntry {
  return {
    company_id: 1,
    agent_id: '1',
    agent_name: 'Agent',
    client_id: '',
    client_name: '',
    token_kind: 'agent',
    user_id: null,
    user_email: '',
    service: 'storage',
    tool_name: 'list_files',
    wrapper_tool: '',
    arguments: {},
    status_code: 200,
    error_code: '',
    error_message: '',
    duration_ms: 12,
    approval_id: '',
    approval_channel: 'none',
    approval_outcome: '',
    operation_title: 'list_files',
    access_kind: 'read',
    outcome: partial.status,
    resource_label: 'list_files',
    ...partial,
  };
}

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
    fetchCompanyMcpCallLogs: vi.fn(async () => ({
      count: 1,
      limit: 200,
      offset: 0,
      call_logs: [
        {
          id: 1,
          company_id: 42,
          agent_id: '1',
          agent_name: 'Agent',
          client_id: '',
          client_name: '',
          token_kind: 'agent',
          user_id: null,
          user_email: '',
          service: 'storage',
          tool_name: 'list_files',
          wrapper_tool: '',
          arguments: {},
          status: 'allowed',
          status_code: 200,
          error_code: '',
          error_message: '',
          duration_ms: 12,
          approval_id: '',
          approval_channel: 'none',
          approval_outcome: '',
          operation_title: 'list_files',
          access_kind: 'read',
          outcome: 'allowed',
          resource_label: 'list_files',
          created_at: new Date().toISOString(),
        } satisfies CompanyMcpCallLogEntry,
      ],
    })),
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
        callLog({
          id: 1,
          status: 'failed',
          status_code: 500,
          created_at: new Date(now).toISOString(),
        }),
      ],
    );
    expect(metrics.pendingApprovals).toBe(2);
    expect(metrics.callLogs24h).toBe(1);
    expect(metrics.callLogErrors24h).toBe(1);
  });
});

describe('fetchMcpCallLogWindow via loadAiDashboardSnapshot', () => {
  it('uses filtered status counts when the window is longer than one page', async () => {
    const { fetchCompanyMcpCallLogs } = await import('@/lib/companyAgentsApi');
    const mocked = vi.mocked(fetchCompanyMcpCallLogs);
    mocked.mockResolvedValueOnce({
      count: 250,
      limit: 200,
      offset: 0,
      call_logs: [callLog({ id: 1, status: 'allowed', created_at: new Date().toISOString() })],
    });
    mocked.mockResolvedValueOnce({ count: 4, limit: 1, offset: 0, call_logs: [] });
    mocked.mockResolvedValueOnce({ count: 1, limit: 1, offset: 0, call_logs: [] });
    const snapshot = await loadAiDashboardSnapshot('token', 42);
    expect(snapshot.metrics?.callLogs24h).toBe(250);
    expect(snapshot.metrics?.callLogErrors24h).toBe(5);
  });
});
