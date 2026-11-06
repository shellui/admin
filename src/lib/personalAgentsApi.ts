import { identityAuthFetch, readJsonOrThrow } from '@/lib/adminIdentityFetch';

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
