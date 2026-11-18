import {
  MCP_CALL_LOG_MAX_LIMIT,
  MCP_CALL_LOG_PAGE_SIZE,
  mcpCallLogListQuery,
} from '@/lib/companyAgentsApi';
import type {
  CompanyMcpAgent,
  CompanyMcpApproval,
  CompanyMcpCallLogEntry,
  CompanyMcpCallLogsPage,
  McpCallLogListQuery,
  McpDiscoveredService,
} from '@/lib/companyAgentsTypes';

type CompanyStore = {
  agents: CompanyMcpAgent[];
  approvals: CompanyMcpApproval[];
  calls: CompanyMcpCallLogEntry[];
};

const stores = new Map<number, CompanyStore>();

function seedStore(companyId: number): CompanyStore {
  const now = Date.now();
  const agentA: CompanyMcpAgent = {
    id: `00000000-0000-4000-8000-${String(companyId).padStart(12, '0')}`,
    name: 'Local Cursor',
    access_mode: 'ask',
    read_level: 'safe',
    allow_destructive_without_asking: false,
    services_allowed: ['identity', 'storage'],
    project_scope: 'Cursor',
    expires_at: new Date(now + 1000 * 60 * 60 * 24 * 30).toISOString(),
    paused_at: null,
    revoked_at: null,
    is_active: true,
    created_at: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(),
  };
  const agentB: CompanyMcpAgent = {
    id: `00000000-0000-4001-8000-${String(companyId).padStart(12, '0')}`,
    name: 'CI read-only',
    access_mode: 'read_only',
    read_level: 'sensitive',
    allow_destructive_without_asking: false,
    services_allowed: ['identity'],
    project_scope: 'Claude Code',
    expires_at: null,
    paused_at: new Date(now - 1000 * 60 * 60).toISOString(),
    revoked_at: null,
    is_active: false,
    created_at: new Date(now - 1000 * 60 * 60 * 24 * 10).toISOString(),
  };
  const approval: CompanyMcpApproval = {
    id: `00000000-0000-4002-8000-${String(companyId).padStart(12, '0')}`,
    agent_id: agentA.id,
    agent_name: agentA.name,
    service: 'storage',
    action: 'delete_object',
    target: 'POST /api/v1/objects/delete',
    arguments_hash: 'abc123',
    arguments_redacted: { bucket: 'uploads', key: 'drafts/report-q4.pdf' },
    expires_at: new Date(now + 1000 * 60 * 8).toISOString(),
  };
  const calls: CompanyMcpCallLogEntry[] = [
    {
      id: 1,
      company_id: companyId,
      agent_id: agentA.id,
      agent_name: agentA.name,
      client_id: '',
      client_name: '',
      token_kind: 'agent',
      user_id: null,
      user_email: '',
      service: 'identity',
      tool_name: 'list_users',
      wrapper_tool: '',
      arguments: {},
      status: 'allowed',
      status_code: 200,
      error_code: '',
      error_message: '',
      duration_ms: 142,
      approval_id: '',
      approval_channel: 'none',
      approval_outcome: '',
      operation_title: 'list_users',
      access_kind: 'read',
      outcome: 'allowed',
      resource_label: 'list_users',
      created_at: new Date(now - 1000 * 60 * 12).toISOString(),
    },
    {
      id: 2,
      company_id: companyId,
      agent_id: agentA.id,
      agent_name: agentA.name,
      client_id: '',
      client_name: '',
      token_kind: 'agent',
      user_id: null,
      user_email: '',
      service: 'storage',
      tool_name: 'list_objects',
      wrapper_tool: 'ai_call_tool',
      arguments: { prefix: 'uploads/' },
      status: 'failed',
      status_code: 500,
      error_code: 'upstream_error',
      error_message: 'Storage timed out.',
      duration_ms: 89,
      approval_id: 'ap-1',
      approval_channel: 'form',
      approval_outcome: 'approved',
      operation_title: 'list_objects',
      access_kind: 'read',
      outcome: 'failed',
      resource_label: 'list_objects',
      created_at: new Date(now - 1000 * 60 * 45).toISOString(),
    },
  ];
  return { agents: [agentA, agentB], approvals: [approval], calls };
}

function storeFor(companyId: number): CompanyStore {
  let s = stores.get(companyId);
  if (!s) {
    s = seedStore(companyId);
    stores.set(companyId, s);
  }
  return s;
}

export function mockFetchAgents(_companyId: number, _identityBaseUrl: string): CompanyMcpAgent[] {
  return [...storeFor(_companyId).agents];
}

export function mockPauseAgent(
  companyId: number,
  _identityBaseUrl: string,
  agentId: string,
): CompanyMcpAgent {
  const s = storeFor(companyId);
  const idx = s.agents.findIndex((a) => a.id === agentId);
  if (idx < 0) throw new Error('Agent not found.');
  s.agents[idx] = {
    ...s.agents[idx],
    paused_at: new Date().toISOString(),
    is_active: false,
  };
  return { ...s.agents[idx] };
}

export function mockRevokeAgent(
  companyId: number,
  _identityBaseUrl: string,
  agentId: string,
): CompanyMcpAgent {
  const s = storeFor(companyId);
  const idx = s.agents.findIndex((a) => a.id === agentId);
  if (idx < 0) throw new Error('Agent not found.');
  const now = new Date().toISOString();
  s.agents[idx] = {
    ...s.agents[idx],
    revoked_at: now,
    paused_at: s.agents[idx].paused_at ?? now,
    is_active: false,
  };
  return { ...s.agents[idx] };
}

export function mockFetchApprovals(
  companyId: number,
  _identityBaseUrl: string,
): CompanyMcpApproval[] {
  return [...storeFor(companyId).approvals];
}

export function mockResolveApproval(
  companyId: number,
  _identityBaseUrl: string,
  approvalId: string,
  _decision: 'approve' | 'reject',
): void {
  const s = storeFor(companyId);
  s.approvals = s.approvals.filter((a) => a.id !== approvalId);
}

export function mockFetchCallLogs(
  companyId: number,
  query: McpCallLogListQuery = {},
): CompanyMcpCallLogsPage {
  const params = mcpCallLogListQuery(query);
  const limit = typeof params.limit === 'number' ? params.limit : MCP_CALL_LOG_PAGE_SIZE;
  const offset = typeof params.offset === 'number' ? params.offset : 0;
  const rows = storeFor(companyId)
    .calls.filter((row) => {
      if (typeof params.agent === 'string' && row.agent_id !== params.agent) return false;
      if (typeof params.service === 'string' && row.service !== params.service) return false;
      if (typeof params.tool === 'string' && row.tool_name !== params.tool) return false;
      if (typeof params.status === 'string' && row.status !== params.status) return false;
      if (typeof params.created_after === 'string' && row.created_at < params.created_after) {
        return false;
      }
      if (typeof params.created_before === 'string' && row.created_at >= params.created_before) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  const pageLimit = Math.min(MCP_CALL_LOG_MAX_LIMIT, Math.max(1, limit));
  return {
    count: rows.length,
    limit: pageLimit,
    offset,
    call_logs: rows.slice(offset, offset + pageLimit),
  };
}

export function mockFetchDiscoveredServices(identityBaseUrl: string): McpDiscoveredService[] {
  const base = identityBaseUrl.replace(/\/+$/, '');
  return [
    { id: 'identity', name: 'Identity', mcp_url: `${base}/mcp` },
    { id: 'storage', name: 'Storage', mcp_url: 'https://storage.example/mcp' },
  ];
}
