import { requireAuthBackendBaseUrl } from '@/lib/backendUrl';
import { identityAuthFetch, readJsonOrThrow } from '@/lib/adminIdentityFetch';
import { ApiUnavailableError } from '@/lib/serviceAuthFetch';
import type {
  CompanyMcpAgent,
  CompanyMcpApproval,
  CompanyMcpCallLogEntry,
  McpAccessMode,
  McpDiscoveredService,
  McpReadLevel,
} from '@/lib/companyAgentsTypes';

export type {
  CompanyMcpAgent,
  CompanyMcpApproval,
  CompanyMcpCallLogEntry,
  McpAccessMode,
  McpDiscoveredService,
  McpReadLevel,
} from '@/lib/companyAgentsTypes';

export const MCP_API_UNAVAILABLE =
  'Requires identity-service with MCP (identity-service PR #110 or newer).';

const MCP_PREFIX = '/api/v1/mcp';

function parseAccessMode(raw: unknown): McpAccessMode {
  if (raw === 'read_only' || raw === 'ask' || raw === 'full') return raw;
  return 'ask';
}

function parseReadLevel(raw: unknown): McpReadLevel {
  return raw === 'sensitive' ? 'sensitive' : 'safe';
}

function parseStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

function parseArguments(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export function parseMcpAgent(row: unknown): CompanyMcpAgent | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string') return null;
  return {
    id: o.id,
    name: o.name,
    access_mode: parseAccessMode(o.access_mode),
    read_level: parseReadLevel(o.read_level),
    allow_destructive_without_asking: o.allow_destructive_without_asking === true,
    services_allowed: parseStringList(o.services_allowed),
    project_scope: typeof o.project_scope === 'string' ? o.project_scope : '',
    expires_at: typeof o.expires_at === 'string' ? o.expires_at : null,
    paused_at: typeof o.paused_at === 'string' ? o.paused_at : null,
    revoked_at: typeof o.revoked_at === 'string' ? o.revoked_at : null,
    is_active: o.is_active === true,
    created_at: typeof o.created_at === 'string' ? o.created_at : new Date().toISOString(),
  };
}

export function parseMcpAgentsResponse(body: unknown): CompanyMcpAgent[] {
  const rows =
    body && typeof body === 'object' && Array.isArray((body as { agents?: unknown }).agents)
      ? (body as { agents: unknown[] }).agents
      : [];
  return rows.map(parseMcpAgent).filter((a): a is CompanyMcpAgent => a != null);
}

export function parseMcpApproval(row: unknown): CompanyMcpApproval | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.action !== 'string') return null;
  const approval: CompanyMcpApproval = {
    id: o.id,
    agent_id: typeof o.agent_id === 'string' ? o.agent_id : '',
    agent_name: typeof o.agent_name === 'string' ? o.agent_name : '-',
    service: typeof o.service === 'string' ? o.service : '-',
    action: o.action,
    arguments_hash: typeof o.arguments_hash === 'string' ? o.arguments_hash : '',
    expires_at: typeof o.expires_at === 'string' ? o.expires_at : new Date().toISOString(),
  };
  if (o.arguments !== undefined) {
    approval.arguments = parseArguments(o.arguments);
  }
  if (o.arguments_redacted !== undefined) {
    approval.arguments = parseArguments(o.arguments_redacted);
  }
  return approval;
}

export function parseMcpApprovalsResponse(body: unknown): CompanyMcpApproval[] {
  const rows =
    body && typeof body === 'object' && Array.isArray((body as { approvals?: unknown }).approvals)
      ? (body as { approvals: unknown[] }).approvals
      : [];
  return rows.map(parseMcpApproval).filter((a): a is CompanyMcpApproval => a != null);
}

export function parseMcpCallLogEntry(row: unknown): CompanyMcpCallLogEntry | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  const id = typeof o.id === 'number' ? o.id : typeof o.id === 'string' ? Number(o.id) : NaN;
  if (!Number.isFinite(id)) return null;
  return {
    id,
    agent_id: typeof o.agent_id === 'string' ? o.agent_id : '',
    agent_name: typeof o.agent_name === 'string' ? o.agent_name : '-',
    service: typeof o.service === 'string' ? o.service : '-',
    tool: typeof o.tool === 'string' ? o.tool : '',
    method:
      typeof o.http_method === 'string'
        ? o.http_method
        : typeof o.method === 'string'
          ? o.method
          : '',
    path: typeof o.path === 'string' ? o.path : '',
    status_code: typeof o.status_code === 'number' ? o.status_code : 0,
    duration_ms: typeof o.duration_ms === 'number' ? o.duration_ms : 0,
    arguments: parseArguments(o.arguments),
    created_at: typeof o.created_at === 'string' ? o.created_at : new Date().toISOString(),
  };
}

export function parseMcpCallLogsResponse(body: unknown): CompanyMcpCallLogEntry[] {
  const rows =
    body && typeof body === 'object' && Array.isArray((body as { call_logs?: unknown }).call_logs)
      ? (body as { call_logs: unknown[] }).call_logs
      : [];
  return rows.map(parseMcpCallLogEntry).filter((c): c is CompanyMcpCallLogEntry => c != null);
}

export function parseMcpServicesResponse(body: unknown): McpDiscoveredService[] {
  const rows =
    body && typeof body === 'object' && Array.isArray((body as { services?: unknown }).services)
      ? (body as { services: unknown[] }).services
      : [];
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.mcp_url !== 'string') return null;
      return {
        id: o.id,
        name: typeof o.name === 'string' ? o.name : o.id,
        mcp_url: o.mcp_url,
      };
    })
    .filter((s): s is McpDiscoveredService => s != null);
}

async function mcpFetch(
  accessToken: string,
  companyId: number,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return identityAuthFetch(`${MCP_PREFIX}${path}`, accessToken, init, { companyId });
}

async function tryDevMock<T>(
  res: Response,
  mockFn: () => T | Promise<T>,
): Promise<{ mocked: true; value: T } | { mocked: false }> {
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_COMPANY_AGENTS_MOCK === '1' &&
    (res.status === 404 || res.status === 501)
  ) {
    return { mocked: true, value: await mockFn() };
  }
  return { mocked: false };
}

export function identityMcpConnectOrigin(): string {
  return requireAuthBackendBaseUrl().replace(/\/+$/, '');
}

export async function fetchCompanyMcpAgents(
  accessToken: string,
  companyId: number,
): Promise<CompanyMcpAgent[]> {
  const res = await mcpFetch(accessToken, companyId, '/agents');
  const devMock = await tryDevMock(res, async () => {
    const { mockFetchAgents } = await import('@/lib/companyAgentsApiMock');
    return mockFetchAgents(companyId, identityMcpConnectOrigin());
  });
  if (devMock.mocked) return devMock.value;
  const body = await readJsonOrThrow(res, MCP_API_UNAVAILABLE);
  return parseMcpAgentsResponse(body);
}

export async function pauseCompanyMcpAgent(
  accessToken: string,
  companyId: number,
  agentId: string,
): Promise<CompanyMcpAgent> {
  const res = await mcpFetch(
    accessToken,
    companyId,
    `/agents/${encodeURIComponent(agentId)}/pause`,
    {
      method: 'POST',
    },
  );
  const devMock = await tryDevMock(res, async () => {
    const { mockPauseAgent } = await import('@/lib/companyAgentsApiMock');
    return mockPauseAgent(companyId, identityMcpConnectOrigin(), agentId);
  });
  if (devMock.mocked) return devMock.value;
  const body = await readJsonOrThrow(res, MCP_API_UNAVAILABLE);
  const agent =
    body && typeof body === 'object' ? parseMcpAgent((body as { agent?: unknown }).agent) : null;
  if (!agent) throw new Error('Unexpected agent response.');
  return agent;
}

export async function revokeCompanyMcpAgent(
  accessToken: string,
  companyId: number,
  agentId: string,
): Promise<CompanyMcpAgent> {
  const res = await mcpFetch(
    accessToken,
    companyId,
    `/agents/${encodeURIComponent(agentId)}/revoke`,
    {
      method: 'POST',
    },
  );
  const devMock = await tryDevMock(res, async () => {
    const { mockRevokeAgent } = await import('@/lib/companyAgentsApiMock');
    return mockRevokeAgent(companyId, identityMcpConnectOrigin(), agentId);
  });
  if (devMock.mocked) return devMock.value;
  const body = await readJsonOrThrow(res, MCP_API_UNAVAILABLE);
  const agent =
    body && typeof body === 'object' ? parseMcpAgent((body as { agent?: unknown }).agent) : null;
  if (!agent) throw new Error('Unexpected agent response.');
  return agent;
}

export async function fetchCompanyMcpApprovals(
  accessToken: string,
  companyId: number,
): Promise<CompanyMcpApproval[]> {
  const res = await mcpFetch(accessToken, companyId, '/approvals');
  const devMock = await tryDevMock(res, async () => {
    const { mockFetchApprovals } = await import('@/lib/companyAgentsApiMock');
    return mockFetchApprovals(companyId, identityMcpConnectOrigin());
  });
  if (devMock.mocked) return devMock.value;
  const body = await readJsonOrThrow(res, MCP_API_UNAVAILABLE);
  return parseMcpApprovalsResponse(body);
}

export async function approveCompanyMcpApproval(
  accessToken: string,
  companyId: number,
  approvalId: string,
): Promise<void> {
  const res = await mcpFetch(
    accessToken,
    companyId,
    `/approvals/${encodeURIComponent(approvalId)}/approve`,
    { method: 'POST' },
  );
  const devMock = await tryDevMock(res, async () => {
    const { mockResolveApproval } = await import('@/lib/companyAgentsApiMock');
    mockResolveApproval(companyId, identityMcpConnectOrigin(), approvalId, 'approve');
  });
  if (devMock.mocked) return;
  if (!res.ok) {
    await readJsonOrThrow(res, MCP_API_UNAVAILABLE);
  }
}

export async function rejectCompanyMcpApproval(
  accessToken: string,
  companyId: number,
  approvalId: string,
): Promise<void> {
  const res = await mcpFetch(
    accessToken,
    companyId,
    `/approvals/${encodeURIComponent(approvalId)}/reject`,
    { method: 'POST' },
  );
  const devMock = await tryDevMock(res, async () => {
    const { mockResolveApproval } = await import('@/lib/companyAgentsApiMock');
    mockResolveApproval(companyId, identityMcpConnectOrigin(), approvalId, 'reject');
  });
  if (devMock.mocked) return;
  if (!res.ok) {
    await readJsonOrThrow(res, MCP_API_UNAVAILABLE);
  }
}

export async function fetchCompanyMcpCallLogs(
  accessToken: string,
  companyId: number,
): Promise<CompanyMcpCallLogEntry[]> {
  const res = await mcpFetch(accessToken, companyId, '/call-logs');
  const devMock = await tryDevMock(res, async () => {
    const { mockFetchAllCallLogs } = await import('@/lib/companyAgentsApiMock');
    return mockFetchAllCallLogs(companyId, identityMcpConnectOrigin());
  });
  if (devMock.mocked) return devMock.value;
  const body = await readJsonOrThrow(res, MCP_API_UNAVAILABLE);
  return parseMcpCallLogsResponse(body);
}

export async function fetchMcpDiscoveredServices(
  accessToken: string,
  companyId: number,
): Promise<McpDiscoveredService[]> {
  const res = await mcpFetch(accessToken, companyId, '/services');
  const devMock = await tryDevMock(res, async () => {
    const { mockFetchDiscoveredServices } = await import('@/lib/companyAgentsApiMock');
    return mockFetchDiscoveredServices(identityMcpConnectOrigin());
  });
  if (devMock.mocked) return devMock.value;
  const body = await readJsonOrThrow(res, MCP_API_UNAVAILABLE);
  return parseMcpServicesResponse(body);
}

export function isMcpApiUnavailable(error: unknown): boolean {
  return (
    error instanceof ApiUnavailableError ||
    (error instanceof Error && error.message === MCP_API_UNAVAILABLE)
  );
}

export function agentDisplayStatus(
  agent: CompanyMcpAgent,
): 'active' | 'paused' | 'revoked' | 'expired' {
  if (agent.revoked_at) return 'revoked';
  if (agent.paused_at) return 'paused';
  if (!agent.is_active) return 'expired';
  return 'active';
}

const DESTRUCTIVE_ACTION =
  /(?:^|[._-])(delete|destroy|purge|remove|revoke|drop|truncate)(?:$|[._-])/i;

export function isDestructiveMcpApproval(approval: CompanyMcpApproval): boolean {
  return DESTRUCTIVE_ACTION.test(approval.action);
}

export function formatApprovalArgumentsForConfirm(approval: CompanyMcpApproval): string {
  const payload = {
    service: approval.service,
    action: approval.action,
    arguments: approval.arguments ?? { arguments_hash: approval.arguments_hash },
  };
  return JSON.stringify(payload, null, 2);
}
