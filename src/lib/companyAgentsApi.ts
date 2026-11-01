import { requireAuthBackendBaseUrl } from '@/lib/backendUrl';
import { identityAuthFetch, readJsonOrThrow } from '@/lib/adminIdentityFetch';
import {
  mockFetchAgents,
  mockFetchApprovals,
  mockFetchCallLog,
  mockFetchMcpSettings,
  mockPatchAgent,
  mockPatchMcpSettings,
  mockPauseAgent,
  mockResolveApproval,
  mockRevokeAgent,
} from '@/lib/companyAgentsApiMock';
import type {
  CompanyMcpAgent,
  CompanyMcpApproval,
  CompanyMcpCallLogEntry,
  CompanyMcpSettings,
  McpServiceId,
} from '@/lib/companyAgentsTypes';

export type {
  CompanyMcpAgent,
  CompanyMcpApproval,
  CompanyMcpCallLogEntry,
  CompanyMcpSettings,
  McpAccessMode,
  McpReadLevel,
  McpServiceId,
} from '@/lib/companyAgentsTypes';
export { MCP_SERVICE_IDS } from '@/lib/companyAgentsTypes';

const UNAVAILABLE = 'Company agents API is not available on this identity version.';

/** When true, identity MCP routes are wired; until then, 404 responses use the in-memory mock. */
let useMockUntilBackend = true;

function identityBase(): string {
  return requireAuthBackendBaseUrl();
}

function shouldUseMock(res: Response): boolean {
  if (res.status === 404 || res.status === 501) {
    useMockUntilBackend = true;
    return true;
  }
  if (res.ok) {
    useMockUntilBackend = false;
  }
  return false;
}

function parseSettings(body: unknown, fallbackUrl: string): CompanyMcpSettings {
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected MCP settings response.');
  }
  const o = body as Record<string, unknown>;
  const servicesRaw = o.services;
  const services =
    servicesRaw && typeof servicesRaw === 'object' ? (servicesRaw as Record<string, boolean>) : {};
  return {
    enabled: o.enabled === true,
    services: {
      identity: services.identity === true,
      storage: services.storage === true,
      hosting: services.hosting === true,
      email: services.email === true,
    },
    mcp_url: typeof o.mcp_url === 'string' ? o.mcp_url : fallbackUrl,
  };
}

function parseAgent(row: unknown): CompanyMcpAgent | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string') return null;
  return {
    id: o.id,
    name: o.name,
    client: typeof o.client === 'string' ? o.client : '-',
    access_mode:
      o.access_mode === 'read_only' ||
      o.access_mode === 'ask_before_changes' ||
      o.access_mode === 'full_access'
        ? o.access_mode
        : 'ask_before_changes',
    read_level: o.read_level === 'sensitive_data' ? 'sensitive_data' : 'safe',
    allowed_services: Array.isArray(o.allowed_services)
      ? (o.allowed_services.filter((s) => typeof s === 'string') as McpServiceId[])
      : [],
    allow_destructive_without_ask: o.allow_destructive_without_ask === true,
    expires_at: typeof o.expires_at === 'string' ? o.expires_at : null,
    last_call_at: typeof o.last_call_at === 'string' ? o.last_call_at : null,
    status:
      o.status === 'paused' || o.status === 'revoked' || o.status === 'active'
        ? o.status
        : 'active',
    created_at: typeof o.created_at === 'string' ? o.created_at : new Date().toISOString(),
  };
}

function parseAgentsList(body: unknown): CompanyMcpAgent[] {
  const rows = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { results?: unknown }).results)
      ? (body as { results: unknown[] }).results
      : [];
  return rows.map(parseAgent).filter((a): a is CompanyMcpAgent => a != null);
}

function parseApproval(row: unknown): CompanyMcpApproval | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.tool !== 'string') return null;
  return {
    id: o.id,
    agent_id: typeof o.agent_id === 'string' ? o.agent_id : '',
    agent_name: typeof o.agent_name === 'string' ? o.agent_name : '-',
    tool: o.tool,
    target: typeof o.target === 'string' ? o.target : '-',
    arguments:
      o.arguments && typeof o.arguments === 'object'
        ? (o.arguments as Record<string, unknown>)
        : {},
    expires_at: typeof o.expires_at === 'string' ? o.expires_at : new Date().toISOString(),
    created_at: typeof o.created_at === 'string' ? o.created_at : new Date().toISOString(),
  };
}

function parseApprovalsList(body: unknown): CompanyMcpApproval[] {
  const rows = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { results?: unknown }).results)
      ? (body as { results: unknown[] }).results
      : [];
  return rows.map(parseApproval).filter((a): a is CompanyMcpApproval => a != null);
}

function parseCallLogEntry(row: unknown): CompanyMcpCallLogEntry | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.tool !== 'string') return null;
  const status = o.status;
  return {
    id: o.id,
    agent_id: typeof o.agent_id === 'string' ? o.agent_id : '',
    at: typeof o.at === 'string' ? o.at : new Date().toISOString(),
    tool: o.tool,
    target: typeof o.target === 'string' ? o.target : '-',
    status:
      status === 'ok' || status === 'error' || status === 'denied' || status === 'pending'
        ? status
        : 'ok',
    duration_ms: typeof o.duration_ms === 'number' ? o.duration_ms : 0,
  };
}

function parseCallLogList(body: unknown): CompanyMcpCallLogEntry[] {
  const rows = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { results?: unknown }).results)
      ? (body as { results: unknown[] }).results
      : [];
  return rows.map(parseCallLogEntry).filter((c): c is CompanyMcpCallLogEntry => c != null);
}

export function companyAgentsUsingMock(): boolean {
  return useMockUntilBackend;
}

export async function fetchCompanyMcpSettings(
  accessToken: string,
  companyId: number,
): Promise<CompanyMcpSettings> {
  const base = identityBase();
  const res = await identityAuthFetch('/api/v1/mcp/settings', accessToken, {}, { companyId });
  if (shouldUseMock(res)) {
    return mockFetchMcpSettings(companyId, base);
  }
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  return parseSettings(body, base);
}

export async function patchCompanyMcpSettings(
  accessToken: string,
  companyId: number,
  payload: Partial<Pick<CompanyMcpSettings, 'enabled' | 'services'>>,
): Promise<CompanyMcpSettings> {
  const base = identityBase();
  const res = await identityAuthFetch(
    '/api/v1/mcp/settings',
    accessToken,
    { method: 'PATCH', body: JSON.stringify(payload) },
    { companyId },
  );
  if (shouldUseMock(res)) {
    return mockPatchMcpSettings(companyId, base, payload);
  }
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  return parseSettings(body, base);
}

export async function fetchCompanyMcpAgents(
  accessToken: string,
  companyId: number,
): Promise<CompanyMcpAgent[]> {
  const base = identityBase();
  const res = await identityAuthFetch('/api/v1/mcp/agents', accessToken, {}, { companyId });
  if (shouldUseMock(res)) {
    return mockFetchAgents(companyId, base);
  }
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  return parseAgentsList(body);
}

export async function patchCompanyMcpAgent(
  accessToken: string,
  companyId: number,
  agentId: string,
  payload: Partial<
    Pick<
      CompanyMcpAgent,
      'access_mode' | 'read_level' | 'allowed_services' | 'allow_destructive_without_ask'
    >
  >,
): Promise<CompanyMcpAgent> {
  const base = identityBase();
  const res = await identityAuthFetch(
    `/api/v1/mcp/agents/${encodeURIComponent(agentId)}`,
    accessToken,
    { method: 'PATCH', body: JSON.stringify(payload) },
    { companyId },
  );
  if (shouldUseMock(res)) {
    return mockPatchAgent(companyId, base, agentId, payload);
  }
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  const agent = parseAgent(body);
  if (!agent) throw new Error('Unexpected agent response.');
  return agent;
}

export async function pauseCompanyMcpAgent(
  accessToken: string,
  companyId: number,
  agentId: string,
): Promise<CompanyMcpAgent> {
  const base = identityBase();
  const res = await identityAuthFetch(
    `/api/v1/mcp/agents/${encodeURIComponent(agentId)}/pause`,
    accessToken,
    { method: 'POST' },
    { companyId },
  );
  if (shouldUseMock(res)) {
    return mockPauseAgent(companyId, base, agentId);
  }
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  const agent = parseAgent(body);
  if (!agent) throw new Error('Unexpected agent response.');
  return agent;
}

export async function revokeCompanyMcpAgent(
  accessToken: string,
  companyId: number,
  agentId: string,
): Promise<CompanyMcpAgent> {
  const base = identityBase();
  const res = await identityAuthFetch(
    `/api/v1/mcp/agents/${encodeURIComponent(agentId)}/revoke`,
    accessToken,
    { method: 'POST' },
    { companyId },
  );
  if (shouldUseMock(res)) {
    return mockRevokeAgent(companyId, base, agentId);
  }
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  const agent = parseAgent(body);
  if (!agent) throw new Error('Unexpected agent response.');
  return agent;
}

export async function fetchCompanyMcpApprovals(
  accessToken: string,
  companyId: number,
): Promise<CompanyMcpApproval[]> {
  const base = identityBase();
  const res = await identityAuthFetch('/api/v1/mcp/approvals', accessToken, {}, { companyId });
  if (shouldUseMock(res)) {
    return mockFetchApprovals(companyId, base);
  }
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  return parseApprovalsList(body);
}

export async function resolveCompanyMcpApproval(
  accessToken: string,
  companyId: number,
  approvalId: string,
  decision: 'approve' | 'reject',
): Promise<void> {
  const base = identityBase();
  const res = await identityAuthFetch(
    `/api/v1/mcp/approvals/${encodeURIComponent(approvalId)}/${decision}`,
    accessToken,
    { method: 'POST' },
    { companyId },
  );
  if (shouldUseMock(res)) {
    mockResolveApproval(companyId, base, approvalId, decision);
    return;
  }
  if (!res.ok) {
    await readJsonOrThrow(res, UNAVAILABLE);
  }
}

export async function fetchCompanyMcpCallLog(
  accessToken: string,
  companyId: number,
  agentId: string,
): Promise<CompanyMcpCallLogEntry[]> {
  const base = identityBase();
  const res = await identityAuthFetch(
    `/api/v1/mcp/agents/${encodeURIComponent(agentId)}/calls`,
    accessToken,
    {},
    { companyId },
  );
  if (shouldUseMock(res)) {
    return mockFetchCallLog(companyId, base, agentId);
  }
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  return parseCallLogList(body);
}
