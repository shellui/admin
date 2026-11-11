import { getAiServiceBaseUrl, requireAiServiceBaseUrl } from '@/lib/aiServiceUrl';
import { identityAuthFetch, readJsonOrThrow } from '@/lib/adminIdentityFetch';
import { ApiUnavailableError, serviceAuthFetch } from '@/lib/serviceAuthFetch';
import {
  MCP_CALL_LOG_SERVICES,
  MCP_CALL_LOG_STATUSES,
  type CompanyMcpAgent,
  type CompanyMcpApproval,
  type CompanyMcpCallLogEntry,
  type CompanyMcpCallLogsPage,
  type McpAccessMode,
  type McpAgentKind,
  type McpCallLogListQuery,
  type McpDiscoveredService,
  type McpReadLevel,
} from '@/lib/companyAgentsTypes';

export type {
  CompanyMcpAgent,
  CompanyMcpApproval,
  CompanyMcpCallLogEntry,
  CompanyMcpCallLogsPage,
  McpAccessMode,
  McpAgentKind,
  McpApprovalChannel,
  McpCallLogListQuery,
  McpCallLogService,
  McpCallLogStatus,
  McpCallOutcome,
  McpDiscoveredService,
  McpReadLevel,
} from '@/lib/companyAgentsTypes';

export { MCP_CALL_LOG_SERVICES, MCP_CALL_LOG_STATUSES };

export const MCP_API_UNAVAILABLE =
  'Requires identity-service with MCP (identity-service PR #110 or newer).';

/** Shown when ai-service does not expose the company call-log list. */
export const MCP_CALL_LOGS_UNAVAILABLE = 'Call logs are not available from ai-service.';

const MCP_PREFIX = '/api/v1/mcp';
const AI_MCP_CALL_LOGS_PATH = '/ai/v1/mcp/call-logs';

/** ai-service default page size. The API allows 1..200. */
export const MCP_CALL_LOG_PAGE_SIZE = 50;
export const MCP_CALL_LOG_MAX_LIMIT = 200;

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

/**
 * Company admin `GET /api/v1/mcp/agents` may omit `kind`.
 * A personal credential wins over an OAuth client id, matching identity's
 * personal-agent list (`kind: "personal"` when a static secret exists).
 */
export function parseMcpAgentKind(row: Record<string, unknown>): McpAgentKind | null {
  if (row.kind === 'oauth' || row.kind === 'personal') return row.kind;
  const personalToken =
    typeof row.personal_token_id === 'string' && row.personal_token_id.trim() !== '';
  const oauthClient = typeof row.oauth_client_id === 'string' && row.oauth_client_id.trim() !== '';
  if (personalToken) return 'personal';
  if (oauthClient) return 'oauth';
  return null;
}

function parseCreatedBy(raw: unknown): CompanyMcpAgent['created_by'] {
  if (typeof raw === 'string' && raw.trim()) {
    return { display_name: raw.trim() };
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const display =
    typeof o.display_name === 'string' && o.display_name.trim()
      ? o.display_name.trim()
      : typeof o.name === 'string' && o.name.trim()
        ? o.name.trim()
        : typeof o.label === 'string' && o.label.trim()
          ? o.label.trim()
          : null;
  return display ? { display_name: display } : null;
}

export function parseMcpAgent(row: unknown): CompanyMcpAgent | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string') return null;
  return {
    id: o.id,
    name: o.name,
    kind: parseMcpAgentKind(o),
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
    created_by:
      parseCreatedBy(o.created_by) ??
      (typeof o.created_by_display_name === 'string'
        ? parseCreatedBy(o.created_by_display_name)
        : null),
    call_count:
      typeof o.call_count === 'number' && Number.isFinite(o.call_count) ? o.call_count : null,
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
    target: typeof o.target === 'string' ? o.target : '',
    arguments_hash: typeof o.arguments_hash === 'string' ? o.arguments_hash : '',
    expires_at: typeof o.expires_at === 'string' ? o.expires_at : new Date().toISOString(),
  };
  if (Object.prototype.hasOwnProperty.call(o, 'arguments_redacted')) {
    approval.arguments_redacted = parseArguments(o.arguments_redacted);
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

function parseOptionalString(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}

function parseOptionalInt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}

export function parseMcpCallLogEntry(row: unknown): CompanyMcpCallLogEntry | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  const id = typeof o.id === 'number' ? o.id : typeof o.id === 'string' ? Number(o.id) : NaN;
  if (!Number.isFinite(id)) return null;
  const entry: CompanyMcpCallLogEntry = {
    id,
    company_id: parseOptionalInt(o.company_id),
    agent_id: parseOptionalString(o.agent_id),
    agent_name: typeof o.agent_name === 'string' ? o.agent_name : '-',
    client_id: parseOptionalString(o.client_id),
    client_name: parseOptionalString(o.client_name),
    token_kind: parseOptionalString(o.token_kind),
    user_id: parseOptionalInt(o.user_id),
    user_email: parseOptionalString(o.user_email),
    service: typeof o.service === 'string' ? o.service : '-',
    tool_name: parseOptionalString(o.tool_name),
    wrapper_tool: parseOptionalString(o.wrapper_tool),
    arguments: parseArguments(o.arguments),
    status: parseOptionalString(o.status),
    status_code: typeof o.status_code === 'number' ? o.status_code : 0,
    error_code: parseOptionalString(o.error_code),
    error_message: parseOptionalString(o.error_message),
    duration_ms: parseOptionalInt(o.duration_ms),
    approval_id: parseOptionalString(o.approval_id),
    approval_channel: parseOptionalString(o.approval_channel) || 'none',
    approval_outcome: parseOptionalString(o.approval_outcome),
    operation_title: parseOptionalString(o.operation_title),
    access_kind: parseOptionalString(o.access_kind) || 'unknown',
    outcome: parseOptionalString(o.outcome),
    resource_label: parseOptionalString(o.resource_label),
    created_at: typeof o.created_at === 'string' ? o.created_at : new Date().toISOString(),
  };
  if (typeof o.agent_audit_scope === 'string' && o.agent_audit_scope) {
    entry.agent_audit_scope = o.agent_audit_scope;
  }
  if ('global_agent_id' in o) {
    entry.global_agent_id = typeof o.global_agent_id === 'string' ? o.global_agent_id : null;
  }
  if ('global_company_id' in o) {
    entry.global_company_id = typeof o.global_company_id === 'string' ? o.global_company_id : null;
  }
  return entry;
}

export function parseMcpCallLogsResponse(body: unknown): CompanyMcpCallLogsPage {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const rows = Array.isArray(record.call_logs) ? record.call_logs : [];
  const call_logs = rows
    .map(parseMcpCallLogEntry)
    .filter((c): c is CompanyMcpCallLogEntry => c != null);
  const count =
    typeof record.count === 'number' && Number.isFinite(record.count)
      ? record.count
      : call_logs.length;
  const limit =
    typeof record.limit === 'number' && Number.isFinite(record.limit)
      ? record.limit
      : call_logs.length;
  const offset =
    typeof record.offset === 'number' && Number.isFinite(record.offset) ? record.offset : 0;
  return { count, limit, offset, call_logs };
}

function clampCallLogLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return MCP_CALL_LOG_PAGE_SIZE;
  return Math.min(MCP_CALL_LOG_MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

function clampCallLogOffset(offset: number | undefined): number {
  if (offset == null || !Number.isFinite(offset) || offset < 0) return 0;
  return Math.trunc(offset);
}

const CALL_LOG_SERVICE_SET = new Set<string>(MCP_CALL_LOG_SERVICES);
const CALL_LOG_STATUS_SET = new Set<string>(MCP_CALL_LOG_STATUSES);

/** Query string for `GET /ai/v1/mcp/call-logs`. Omits blank filters. */
export function mcpCallLogListQuery(
  query: McpCallLogListQuery = {},
): Record<string, string | number | undefined> {
  const service =
    query.service && CALL_LOG_SERVICE_SET.has(query.service) ? query.service : undefined;
  const status = query.status && CALL_LOG_STATUS_SET.has(query.status) ? query.status : undefined;
  return {
    agent: query.agent?.trim() || undefined,
    service,
    tool: query.tool?.trim() || undefined,
    status,
    created_after: query.createdAfter?.trim() || undefined,
    created_before: query.createdBefore?.trim() || undefined,
    limit: clampCallLogLimit(query.limit),
    offset: clampCallLogOffset(query.offset),
  };
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
  if (import.meta.env.PROD) {
    return { mocked: false };
  }
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_COMPANY_AGENTS_MOCK === '1' &&
    (res.status === 404 || res.status === 501)
  ) {
    return { mocked: true, value: await mockFn() };
  }
  return { mocked: false };
}

/** ai-service origin for MCP client connect URLs (`POST /mcp` on ai-service). */
export function aiServiceMcpConnectOrigin(): string | null {
  return getAiServiceBaseUrl();
}

export async function fetchCompanyMcpAgents(
  accessToken: string,
  companyId: number,
): Promise<CompanyMcpAgent[]> {
  const res = await mcpFetch(accessToken, companyId, '/agents');
  const devMock = await tryDevMock(res, async () => {
    const { mockFetchAgents } = await import('@/lib/companyAgentsApiMock');
    return mockFetchAgents(companyId, aiServiceMcpConnectOrigin() ?? 'https://ai.example.com');
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
    return mockPauseAgent(
      companyId,
      aiServiceMcpConnectOrigin() ?? 'https://ai.example.com',
      agentId,
    );
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
    return mockRevokeAgent(
      companyId,
      aiServiceMcpConnectOrigin() ?? 'https://ai.example.com',
      agentId,
    );
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
    return mockFetchApprovals(companyId, aiServiceMcpConnectOrigin() ?? 'https://ai.example.com');
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
    mockResolveApproval(
      companyId,
      aiServiceMcpConnectOrigin() ?? 'https://ai.example.com',
      approvalId,
      'approve',
    );
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
    mockResolveApproval(
      companyId,
      aiServiceMcpConnectOrigin() ?? 'https://ai.example.com',
      approvalId,
      'reject',
    );
  });
  if (devMock.mocked) return;
  if (!res.ok) {
    await readJsonOrThrow(res, MCP_API_UNAVAILABLE);
  }
}

/**
 * Company MCP tool-call log from ai-service `GET /ai/v1/mcp/call-logs`.
 * The bearer token is the signed-in user's app JWT. ai-service reads the
 * company from that token, so this request does not send `company_id`.
 */
export async function fetchCompanyMcpCallLogs(
  accessToken: string,
  companyId: number,
  query: McpCallLogListQuery = {},
): Promise<CompanyMcpCallLogsPage> {
  const res = await serviceAuthFetch(
    requireAiServiceBaseUrl(),
    AI_MCP_CALL_LOGS_PATH,
    accessToken,
    {},
    { query: mcpCallLogListQuery(query) },
  );
  const devMock = await tryDevMock(res, async () => {
    const { mockFetchCallLogs } = await import('@/lib/companyAgentsApiMock');
    return mockFetchCallLogs(companyId, query);
  });
  if (devMock.mocked) return devMock.value;
  const body = await readJsonOrThrow(res, MCP_CALL_LOGS_UNAVAILABLE);
  return parseMcpCallLogsResponse(body);
}

export async function fetchMcpDiscoveredServices(
  accessToken: string,
  companyId: number,
): Promise<McpDiscoveredService[]> {
  const res = await mcpFetch(accessToken, companyId, '/services');
  const devMock = await tryDevMock(res, async () => {
    const { mockFetchDiscoveredServices } = await import('@/lib/companyAgentsApiMock');
    return mockFetchDiscoveredServices(aiServiceMcpConnectOrigin() ?? 'https://ai.example.com');
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

/** True when identity included `arguments_redacted` on the approval row (may be empty). */
export function mcpApprovalHasRedactedArguments(approval: CompanyMcpApproval): boolean {
  return approval.arguments_redacted !== undefined;
}

export function formatApprovalArgumentsForConfirm(approval: CompanyMcpApproval): string {
  const payload: Record<string, unknown> = {
    service: approval.service,
    action: approval.action,
    target: approval.target,
  };
  if (mcpApprovalHasRedactedArguments(approval)) {
    payload.arguments_redacted = approval.arguments_redacted;
  } else {
    payload.arguments_hash = approval.arguments_hash;
  }
  return JSON.stringify(payload, null, 2);
}

export function formatCallLogArguments(args: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return '';
  return JSON.stringify(args, null, 2);
}

/** True when ai-service recorded the call as a failure (`failed` or `error`). */
export function isFailedMcpCallLog(entry: Pick<CompanyMcpCallLogEntry, 'status'>): boolean {
  return entry.status === 'failed' || entry.status === 'error';
}

export function agentCreatorDisplayName(agent: CompanyMcpAgent): string | null {
  const name = agent.created_by?.display_name?.trim();
  return name || null;
}
