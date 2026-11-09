import { identityAuthFetch, readJsonOrThrow } from '@/lib/adminIdentityFetch';
import type { McpAgentKind } from '@/lib/companyAgentsTypes';

export const MCP_PERSONAL_SERVICE_OPTIONS = [
  'identity',
  'storage',
  'hosting',
  'email',
  'saas',
] as const;

export type McpPersonalService = (typeof MCP_PERSONAL_SERVICE_OPTIONS)[number];
export type McpAccessMode = 'read_only' | 'ask' | 'full';
export type McpReadLevel = 'safe' | 'sensitive';

export type McpPersonalStatus = {
  mcp_enabled: boolean;
  mcp_url: string | null;
  global_identity?: boolean;
};

export type CreatePersonalAgentInput = {
  name: string;
  services: McpPersonalService[];
  access_mode: McpAccessMode;
  read_level: McpReadLevel;
  allow_destructive: boolean;
  expires_at: string;
};

export type CreatePersonalAgentResult = {
  access_token: string;
  token_type: string;
  expires_at: string;
  resource: string;
};

/** One row from `GET /api/v1/mcp/personal/agents`. */
export type McpPersonalAgent = {
  id: string;
  kind: McpAgentKind;
  name: string;
  access_mode: McpAccessMode;
  read_level: McpReadLevel;
  allow_destructive_without_asking: boolean;
  services_allowed: string[];
  expires_at: string | null;
  paused_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
  created_at: string;
  oauth_client_id: string | null;
  personal_token_id: string | null;
};

function parsePersonalStatus(body: unknown): McpPersonalStatus | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.mcp_enabled !== 'boolean') return null;
  return {
    mcp_enabled: o.mcp_enabled,
    mcp_url: typeof o.mcp_url === 'string' ? o.mcp_url : null,
    ...(typeof o.global_identity === 'boolean' ? { global_identity: o.global_identity } : {}),
  };
}

function parseCreateResult(body: unknown): CreatePersonalAgentResult | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const accessToken = typeof o.access_token === 'string' ? o.access_token : '';
  const tokenType = typeof o.token_type === 'string' ? o.token_type : '';
  const expiresAt = typeof o.expires_at === 'string' ? o.expires_at : '';
  const resource = typeof o.resource === 'string' ? o.resource : '';
  if (!accessToken || !expiresAt) return null;
  return {
    access_token: accessToken,
    token_type: tokenType || 'bearer',
    expires_at: expiresAt,
    resource,
  };
}

export async function fetchMcpPersonalStatus(
  accessToken: string,
  companyId: number,
): Promise<McpPersonalStatus | null> {
  const res = await identityAuthFetch(
    '/api/v1/mcp/personal/status',
    accessToken,
    {},
    { companyId },
  );
  if (res.status === 404) return null;
  const body = await readJsonOrThrow(res, 'Personal MCP is not available.');
  return parsePersonalStatus(body);
}

export type CreateMcpPersonalAgentOptions = {
  allowSaas?: boolean;
};

export async function createMcpPersonalAgent(
  accessToken: string,
  companyId: number,
  input: CreatePersonalAgentInput,
  options: CreateMcpPersonalAgentOptions = {},
): Promise<CreatePersonalAgentResult> {
  const allowSaas = options.allowSaas === true;
  const services = allowSaas
    ? input.services
    : input.services.filter((service) => service !== 'saas');
  const res = await identityAuthFetch(
    '/api/v1/mcp/personal/agents/create',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        services,
        access_mode: input.access_mode,
        read_level: input.read_level,
        allow_destructive: input.allow_destructive,
        expires_at: input.expires_at,
      }),
    },
    { companyId },
  );
  const body = await readJsonOrThrow(res, 'Could not create MCP connection.');
  const parsed = parseCreateResult(body);
  if (!parsed) throw new Error('Unexpected response from identity.');
  return parsed;
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

export function parseMcpPersonalAgent(row: unknown): McpPersonalAgent | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  const id = asTrimmedString(o.id);
  const name = asTrimmedString(o.name);
  const createdAt = asTrimmedString(o.created_at);
  const kind = o.kind === 'oauth' || o.kind === 'personal' ? o.kind : null;
  const accessMode =
    o.access_mode === 'read_only' || o.access_mode === 'ask' || o.access_mode === 'full'
      ? o.access_mode
      : null;
  const readLevel = o.read_level === 'safe' || o.read_level === 'sensitive' ? o.read_level : null;
  if (!id || !name || !createdAt || !kind || !accessMode || !readLevel) return null;
  return {
    id,
    kind,
    name,
    access_mode: accessMode,
    read_level: readLevel,
    allow_destructive_without_asking: o.allow_destructive_without_asking === true,
    services_allowed: asStringList(o.services_allowed),
    expires_at: asTrimmedString(o.expires_at),
    paused_at: asTrimmedString(o.paused_at),
    revoked_at: asTrimmedString(o.revoked_at),
    is_active: o.is_active === true,
    created_at: createdAt,
    oauth_client_id: asTrimmedString(o.oauth_client_id),
    personal_token_id: asTrimmedString(o.personal_token_id),
  };
}

export function parseMcpPersonalAgentsResponse(body: unknown): McpPersonalAgent[] {
  const rows =
    body && typeof body === 'object' && Array.isArray((body as { agents?: unknown }).agents)
      ? (body as { agents: unknown[] }).agents
      : [];
  return rows.map(parseMcpPersonalAgent).filter((row): row is McpPersonalAgent => row != null);
}

/** OAuth device-login and static secrets for the signed-in member. 404 yields an empty list. */
export async function fetchMcpPersonalAgents(
  accessToken: string,
  companyId: number,
): Promise<McpPersonalAgent[]> {
  const res = await identityAuthFetch(
    '/api/v1/mcp/personal/agents',
    accessToken,
    {},
    { companyId },
  );
  if (res.status === 404) return [];
  const body = await readJsonOrThrow(res, 'Personal MCP agents are not available.');
  return parseMcpPersonalAgentsResponse(body);
}

export async function revokeMcpPersonalAgent(
  accessToken: string,
  companyId: number,
  agentId: string,
): Promise<McpPersonalAgent> {
  const res = await identityAuthFetch(
    `/api/v1/mcp/personal/agents/${encodeURIComponent(agentId)}/revoke`,
    accessToken,
    { method: 'POST' },
    { companyId },
  );
  const body = await readJsonOrThrow(res, 'Could not revoke MCP connection.');
  const agent =
    body && typeof body === 'object'
      ? parseMcpPersonalAgent((body as { agent?: unknown }).agent)
      : null;
  if (!agent) throw new Error('Unexpected response from identity.');
  return agent;
}
