/** Identity personal-agent list: OAuth device login, or a static personal secret. */
export type McpAgentKind = 'oauth' | 'personal';

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
  /**
   * Set when identity sends `kind`, or when a personal-agent row is merged in.
   * `oauth` is device login. `personal` is a static secret.
   */
  kind?: McpAgentKind | null;
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

/** Services accepted by ai-service `GET /ai/v1/mcp/call-logs`. */
export const MCP_CALL_LOG_SERVICES = [
  'identity',
  'storage',
  'hosting',
  'email',
  'saas',
  'ai',
] as const;
export type McpCallLogService = (typeof MCP_CALL_LOG_SERVICES)[number];

/** Status values accepted by ai-service `GET /ai/v1/mcp/call-logs`. */
export const MCP_CALL_LOG_STATUSES = [
  'allowed',
  'denied',
  'waiting_approval',
  'failed',
  'error',
] as const;
export type McpCallLogStatus = (typeof MCP_CALL_LOG_STATUSES)[number];

export type McpApprovalChannel = 'form' | 'link' | 'none';

export type McpAccessKind = 'read' | 'write' | 'destructive' | 'unknown';

/** ai-service display outcome. Distinct from the filterable `status`. */
export type McpCallOutcome = 'allowed' | 'failed' | 'denied' | 'waiting_approval' | 'session_used';

/**
 * One MCP tool call recorded by ai-service.
 * `tool_name` is the inner tool. `wrapper_tool` is `ai_call_tool` when the
 * call went through that wrapper, otherwise empty.
 */
export type CompanyMcpCallLogEntry = {
  id: number;
  company_id: number | null;
  agent_id: string;
  agent_name: string;
  client_id: string;
  client_name: string;
  token_kind: string;
  user_id: number | null;
  user_email: string;
  service: string;
  tool_name: string;
  wrapper_tool: string;
  arguments: Record<string, unknown>;
  status: string;
  status_code: number;
  error_code: string;
  error_message: string;
  duration_ms: number | null;
  approval_id: string;
  approval_channel: string;
  approval_outcome: string;
  operation_title: string;
  access_kind: string;
  outcome: string;
  resource_label: string;
  agent_audit_scope?: string;
  global_agent_id?: string | null;
  global_company_id?: string | null;
  created_at: string;
};

export type CompanyMcpCallLogsPage = {
  count: number;
  limit: number;
  offset: number;
  call_logs: CompanyMcpCallLogEntry[];
};

export type McpCallLogListQuery = {
  agent?: string;
  service?: McpCallLogService;
  tool?: string;
  status?: McpCallLogStatus;
  /** Inclusive ISO-8601 lower bound. */
  createdAfter?: string;
  /** Exclusive ISO-8601 upper bound. */
  createdBefore?: string;
  limit?: number;
  offset?: number;
};

export type McpDiscoveredService = {
  id: string;
  name: string;
  mcp_url: string;
};

export type CompanyMcpAgentsResponse = { agents: CompanyMcpAgent[] };
export type CompanyMcpApprovalsResponse = { approvals: CompanyMcpApproval[] };
export type CompanyMcpCallLogsResponse = CompanyMcpCallLogsPage;
export type McpServicesResponse = { services: McpDiscoveredService[] };
