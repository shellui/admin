/** MCP services exposed to agents for a company. Align with identity-service when the backend lands. */
export const MCP_SERVICE_IDS = ['identity', 'storage', 'hosting', 'email'] as const;
export type McpServiceId = (typeof MCP_SERVICE_IDS)[number];

export type McpAccessMode = 'read_only' | 'ask_before_changes' | 'full_access';
export type McpReadLevel = 'safe' | 'sensitive_data';
export type McpAgentStatus = 'active' | 'paused' | 'revoked';

export type CompanyMcpSettings = {
  enabled: boolean;
  services: Record<McpServiceId, boolean>;
  mcp_url: string;
};

export type CompanyMcpAgent = {
  id: string;
  name: string;
  client: string;
  access_mode: McpAccessMode;
  read_level: McpReadLevel;
  allowed_services: McpServiceId[];
  allow_destructive_without_ask: boolean;
  expires_at: string | null;
  last_call_at: string | null;
  status: McpAgentStatus;
  created_at: string;
};

export type CompanyMcpApproval = {
  id: string;
  agent_id: string;
  agent_name: string;
  tool: string;
  target: string;
  arguments: Record<string, unknown>;
  expires_at: string;
  created_at: string;
};

export type CompanyMcpCallLogEntry = {
  id: string;
  agent_id: string;
  at: string;
  tool: string;
  target: string;
  status: 'ok' | 'error' | 'denied' | 'pending';
  duration_ms: number;
};

export type CompanyMcpAgentsListResponse = { results: CompanyMcpAgent[] };
export type CompanyMcpApprovalsListResponse = { results: CompanyMcpApproval[] };
export type CompanyMcpCallLogListResponse = { results: CompanyMcpCallLogEntry[] };
