/** Matches identity-service Agent.access_mode values. */
export type McpAccessMode = 'read_only' | 'ask' | 'full';

/** Matches identity-service Agent.read_level values. */
export type McpReadLevel = 'safe' | 'sensitive';

export type CompanyMcpAgentCreatedBy = {
  /** Person name or system/service account label from identity when available. */
  display_name?: string | null;
};

export type CompanyMcpAgent = {
  id: string;
  name: string;
  access_mode: McpAccessMode;
  read_level: McpReadLevel;
  allow_destructive_without_asking: boolean;
  services_allowed: string[];
  project_scope: string;
  expires_at: string | null;
  paused_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
  created_at: string;
  created_by?: CompanyMcpAgentCreatedBy | null;
  /** Total call count when identity includes it on the agent row. */
  call_count?: number | null;
};

export type CompanyMcpApproval = {
  id: string;
  agent_id: string;
  agent_name: string;
  service: string;
  action: string;
  /** HTTP method and path or other target label from identity. */
  target: string;
  arguments_hash: string;
  /** Set only when identity included `arguments_redacted` on the approval row. */
  arguments_redacted?: Record<string, unknown>;
  expires_at: string;
};

export type CompanyMcpCallLogEntry = {
  id: number;
  agent_id: string;
  agent_name: string;
  service: string;
  tool: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number | null;
  arguments: Record<string, unknown>;
  created_at: string;
};

export type McpDiscoveredService = {
  id: string;
  name: string;
  mcp_url: string;
};

export type CompanyMcpAgentsResponse = { agents: CompanyMcpAgent[] };
export type CompanyMcpApprovalsResponse = { approvals: CompanyMcpApproval[] };
export type CompanyMcpCallLogsResponse = { call_logs: CompanyMcpCallLogEntry[] };
export type McpServicesResponse = { services: McpDiscoveredService[] };
