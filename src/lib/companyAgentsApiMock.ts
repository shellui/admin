import {
  MCP_SERVICE_IDS,
  type CompanyMcpAgent,
  type CompanyMcpApproval,
  type CompanyMcpCallLogEntry,
  type CompanyMcpSettings,
  type McpServiceId,
} from '@/lib/companyAgentsTypes';

type CompanyStore = {
  settings: CompanyMcpSettings;
  agents: CompanyMcpAgent[];
  approvals: CompanyMcpApproval[];
  calls: CompanyMcpCallLogEntry[];
};

const stores = new Map<number, CompanyStore>();

function defaultServices(): Record<McpServiceId, boolean> {
  return Object.fromEntries(MCP_SERVICE_IDS.map((id) => [id, false])) as Record<
    McpServiceId,
    boolean
  >;
}

function seedStore(companyId: number, identityBaseUrl: string): CompanyStore {
  const now = Date.now();
  const agentA: CompanyMcpAgent = {
    id: `mock-agent-${companyId}-1`,
    name: 'Local Cursor',
    client: 'Cursor',
    access_mode: 'ask_before_changes',
    read_level: 'safe',
    allowed_services: ['identity', 'storage'],
    allow_destructive_without_ask: false,
    expires_at: new Date(now + 1000 * 60 * 60 * 24 * 30).toISOString(),
    last_call_at: new Date(now - 1000 * 60 * 12).toISOString(),
    status: 'active',
    created_at: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(),
  };
  const agentB: CompanyMcpAgent = {
    id: `mock-agent-${companyId}-2`,
    name: 'CI read-only',
    client: 'Claude Code',
    access_mode: 'read_only',
    read_level: 'sensitive_data',
    allowed_services: ['identity'],
    allow_destructive_without_ask: false,
    expires_at: null,
    last_call_at: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
    status: 'paused',
    created_at: new Date(now - 1000 * 60 * 60 * 24 * 10).toISOString(),
  };
  const approval: CompanyMcpApproval = {
    id: `mock-approval-${companyId}-1`,
    agent_id: agentA.id,
    agent_name: agentA.name,
    tool: 'storage.delete_object',
    target: 'storage',
    arguments: {
      bucket: 'uploads',
      key: 'drafts/report-q4.pdf',
    },
    expires_at: new Date(now + 1000 * 60 * 8).toISOString(),
    created_at: new Date(now - 1000 * 60 * 2).toISOString(),
  };
  const calls: CompanyMcpCallLogEntry[] = [
    {
      id: `mock-call-${companyId}-1`,
      agent_id: agentA.id,
      at: new Date(now - 1000 * 60 * 12).toISOString(),
      tool: 'identity.list_users',
      target: 'identity',
      status: 'ok',
      duration_ms: 142,
    },
    {
      id: `mock-call-${companyId}-2`,
      agent_id: agentA.id,
      at: new Date(now - 1000 * 60 * 45).toISOString(),
      tool: 'storage.list_objects',
      target: 'storage',
      status: 'ok',
      duration_ms: 89,
    },
    {
      id: `mock-call-${companyId}-3`,
      agent_id: agentB.id,
      at: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
      tool: 'hosting.restart_app',
      target: 'hosting',
      status: 'denied',
      duration_ms: 12,
    },
  ];
  return {
    settings: {
      enabled: false,
      services: { ...defaultServices(), identity: true, storage: true },
      mcp_url: identityBaseUrl.replace(/\/+$/, ''),
    },
    agents: [agentA, agentB],
    approvals: [approval],
    calls,
  };
}

function storeFor(companyId: number, identityBaseUrl: string): CompanyStore {
  let s = stores.get(companyId);
  if (!s) {
    s = seedStore(companyId, identityBaseUrl);
    stores.set(companyId, s);
  }
  return s;
}

export function mockFetchMcpSettings(
  companyId: number,
  identityBaseUrl: string,
): CompanyMcpSettings {
  return { ...storeFor(companyId, identityBaseUrl).settings };
}

export function mockPatchMcpSettings(
  companyId: number,
  identityBaseUrl: string,
  patch: Partial<Pick<CompanyMcpSettings, 'enabled' | 'services'>>,
): CompanyMcpSettings {
  const s = storeFor(companyId, identityBaseUrl);
  if (patch.enabled !== undefined) s.settings.enabled = patch.enabled;
  if (patch.services) {
    s.settings.services = { ...s.settings.services, ...patch.services };
  }
  return { ...s.settings };
}

export function mockFetchAgents(companyId: number, identityBaseUrl: string): CompanyMcpAgent[] {
  return [...storeFor(companyId, identityBaseUrl).agents];
}

export function mockPatchAgent(
  companyId: number,
  identityBaseUrl: string,
  agentId: string,
  patch: Partial<
    Pick<
      CompanyMcpAgent,
      'access_mode' | 'read_level' | 'allowed_services' | 'allow_destructive_without_ask' | 'status'
    >
  >,
): CompanyMcpAgent {
  const s = storeFor(companyId, identityBaseUrl);
  const idx = s.agents.findIndex((a) => a.id === agentId);
  if (idx < 0) throw new Error('Agent not found.');
  s.agents[idx] = { ...s.agents[idx], ...patch };
  return { ...s.agents[idx] };
}

export function mockPauseAgent(
  companyId: number,
  identityBaseUrl: string,
  agentId: string,
): CompanyMcpAgent {
  return mockPatchAgent(companyId, identityBaseUrl, agentId, { status: 'paused' });
}

export function mockRevokeAgent(
  companyId: number,
  identityBaseUrl: string,
  agentId: string,
): CompanyMcpAgent {
  return mockPatchAgent(companyId, identityBaseUrl, agentId, { status: 'revoked' });
}

export function mockFetchApprovals(
  companyId: number,
  identityBaseUrl: string,
): CompanyMcpApproval[] {
  return [...storeFor(companyId, identityBaseUrl).approvals];
}

export function mockResolveApproval(
  companyId: number,
  identityBaseUrl: string,
  approvalId: string,
  _decision: 'approve' | 'reject',
): void {
  const s = storeFor(companyId, identityBaseUrl);
  s.approvals = s.approvals.filter((a) => a.id !== approvalId);
}

export function mockFetchCallLog(
  companyId: number,
  identityBaseUrl: string,
  agentId: string,
): CompanyMcpCallLogEntry[] {
  return storeFor(companyId, identityBaseUrl).calls.filter((c) => c.agent_id === agentId);
}
