import { describe, expect, it } from 'vitest';
import {
  countAgentsByDisplayStatus,
  countFailedCallLogs,
  filterCallLogsSince,
  topToolsFromCallLogs,
} from '@/lib/aiStatusStats';
import type { CompanyMcpAgent, CompanyMcpCallLogEntry } from '@/lib/companyAgentsApi';

function callLog(
  partial: Partial<CompanyMcpCallLogEntry> &
    Pick<CompanyMcpCallLogEntry, 'id' | 'created_at' | 'tool_name' | 'status'>,
): CompanyMcpCallLogEntry {
  return {
    company_id: 1,
    agent_id: 'a',
    agent_name: 'A',
    client_id: '',
    client_name: '',
    token_kind: 'agent',
    user_id: null,
    user_email: '',
    service: 'storage',
    wrapper_tool: '',
    arguments: {},
    status_code: 200,
    error_code: '',
    error_message: '',
    duration_ms: 10,
    approval_id: '',
    approval_channel: 'none',
    approval_outcome: '',
    operation_title: partial.tool_name,
    access_kind: 'read',
    outcome: partial.status,
    resource_label: partial.tool_name,
    ...partial,
  };
}

function agent(
  partial: Partial<CompanyMcpAgent> & Pick<CompanyMcpAgent, 'id' | 'name'>,
): CompanyMcpAgent {
  return {
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
    ...partial,
  };
}

describe('aiStatusStats', () => {
  it('counts agents by display status', () => {
    const counts = countAgentsByDisplayStatus([
      agent({ id: '1', name: 'A' }),
      agent({ id: '2', name: 'B', paused_at: '2026-01-02T00:00:00.000Z' }),
      agent({ id: '3', name: 'C', revoked_at: '2026-01-02T00:00:00.000Z' }),
      agent({ id: '4', name: 'D', is_active: false }),
    ]);
    expect(counts).toEqual({ active: 1, paused: 1, revoked: 1, expired: 1 });
  });

  it('filters call logs in a time window and ranks tools', () => {
    const now = Date.parse('2026-01-10T12:00:00.000Z');
    const logs: CompanyMcpCallLogEntry[] = [
      callLog({
        id: 1,
        service: 'storage',
        tool_name: 'list_files',
        status: 'allowed',
        status_code: 200,
        created_at: '2026-01-10T11:00:00.000Z',
      }),
      callLog({
        id: 2,
        service: 'storage',
        tool_name: 'list_files',
        status: 'failed',
        status_code: 500,
        created_at: '2026-01-09T11:00:00.000Z',
      }),
      callLog({
        id: 3,
        service: 'hosting',
        tool_name: 'deploy',
        status: 'allowed',
        status_code: 201,
        created_at: '2026-01-10T10:00:00.000Z',
      }),
    ];
    const recent = filterCallLogsSince(logs, 24 * 60 * 60 * 1000, now);
    expect(recent).toHaveLength(2);
    expect(countFailedCallLogs(recent)).toBe(0);
    expect(countFailedCallLogs(logs.filter((entry) => entry.status === 'failed'))).toBe(1);
    expect(topToolsFromCallLogs(recent)).toEqual([
      { tool: 'deploy', count: 1 },
      { tool: 'list_files', count: 1 },
    ]);
  });
});
