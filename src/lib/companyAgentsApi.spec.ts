import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiServiceNotConfiguredError } from '@/lib/aiServiceUrl';
import {
  agentCreatorDisplayName,
  fetchCompanyMcpCallLogs,
  formatApprovalArgumentsForConfirm,
  formatCallLogArguments,
  isDestructiveMcpApproval,
  isFailedMcpCallLog,
  MCP_CALL_LOGS_UNAVAILABLE,
  mcpApprovalHasRedactedArguments,
  mcpCallLogListQuery,
  parseMcpAgent,
  parseMcpAgentKind,
  parseMcpAgentsResponse,
  parseMcpApproval,
  parseMcpCallLogEntry,
  parseMcpCallLogsResponse,
} from '@/lib/companyAgentsApi';

const aiUrlState = vi.hoisted(() => ({ url: 'http://localhost:8006' as string | null }));

vi.mock('@/lib/aiServiceUrl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/aiServiceUrl')>();
  return {
    ...actual,
    requireAiServiceBaseUrl: () => {
      if (!aiUrlState.url) throw new actual.AiServiceNotConfiguredError();
      return aiUrlState.url;
    },
  };
});

describe('companyAgentsApi parsers', () => {
  it('parses agent rows from identity admin API', () => {
    const body = {
      agents: [
        {
          id: 'a1',
          name: 'Cursor',
          access_mode: 'ask',
          read_level: 'safe',
          allow_destructive_without_asking: false,
          services_allowed: ['identity'],
          project_scope: 'playground',
          expires_at: null,
          paused_at: null,
          revoked_at: null,
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    };
    const agents = parseMcpAgentsResponse(body);
    expect(agents).toHaveLength(1);
    expect(agents[0]?.access_mode).toBe('ask');
  });

  it('reads oauth and personal kinds from the company agent list', () => {
    expect(
      parseMcpAgent({
        id: 'oauth-1',
        name: 'Device login',
        kind: 'oauth',
        services_allowed: ['identity', 'storage'],
        created_at: '2026-06-01T00:00:00Z',
      })?.kind,
    ).toBe('oauth');
    expect(
      parseMcpAgentKind({
        personal_token_id: 'pt-1',
        oauth_client_id: 'client-1',
      }),
    ).toBe('personal');
    expect(parseMcpAgentKind({ oauth_client_id: 'client-1' })).toBe('oauth');
    expect(
      parseMcpAgent({
        id: 'plain',
        name: 'Legacy',
        created_at: '2026-01-01T00:00:00Z',
      })?.kind,
    ).toBeNull();
  });

  it('parses full access mode', () => {
    const agent = parseMcpAgent({
      id: 'x',
      name: 'n',
      access_mode: 'full',
      read_level: 'sensitive',
      allow_destructive_without_asking: true,
      services_allowed: [],
      is_active: false,
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(agent?.access_mode).toBe('full');
    expect(agent?.read_level).toBe('sensitive');
  });

  it('parses approval rows like identity admin API', () => {
    const row = parseMcpApproval({
      id: 'p1',
      agent_id: 'a1',
      agent_name: 'Agent',
      service: 'storage',
      action: 'delete_object',
      target: 'POST /api/v1/objects/delete',
      arguments_hash: 'hash',
      arguments_redacted: { key: 'x' },
      expires_at: '2026-01-01T00:10:00Z',
    });
    expect(row?.target).toBe('POST /api/v1/objects/delete');
    expect(row?.arguments_redacted).toEqual({ key: 'x' });
    expect(isDestructiveMcpApproval(row!)).toBe(true);
  });

  it('treats empty arguments_redacted as present', () => {
    const row = parseMcpApproval({
      id: 'p2',
      agent_id: 'a1',
      agent_name: 'Agent',
      service: 'identity',
      action: 'noop',
      target: 'GET /api/v1/health',
      arguments_hash: 'hash',
      arguments_redacted: {},
      expires_at: '2026-01-01T00:10:00Z',
    });
    expect(mcpApprovalHasRedactedArguments(row!)).toBe(true);
  });

  it('formats confirm payload with hash when args missing', () => {
    const pending = {
      id: '1',
      agent_id: 'a',
      agent_name: 'A',
      service: 'identity',
      action: 'patch_user',
      target: '',
      arguments_hash: 'abc',
      expires_at: '2026-01-01T00:00:00Z',
    };
    expect(mcpApprovalHasRedactedArguments(pending)).toBe(false);
    const json = formatApprovalArgumentsForConfirm(pending);
    expect(json).toContain('"arguments_hash": "abc"');
    expect(json).not.toContain('"arguments": {');
  });

  it('formats confirm payload with redacted arguments when present', () => {
    const row = {
      id: '1',
      agent_id: 'a',
      agent_name: 'A',
      service: 'identity',
      action: 'patch_user',
      target: 'PATCH /api/v1/users/u1',
      arguments_hash: 'abc',
      arguments_redacted: { user_id: 'u1' },
      expires_at: '2026-01-01T00:00:00Z',
    };
    expect(mcpApprovalHasRedactedArguments(row)).toBe(true);
    const json = formatApprovalArgumentsForConfirm(row);
    expect(json).toContain('"user_id": "u1"');
    expect(json).toContain('"target": "PATCH /api/v1/users/u1"');
  });

  it('serializes call log arguments as JSON text', () => {
    expect(formatCallLogArguments({ prefix: 'uploads/' })).toContain('uploads/');
    expect(formatCallLogArguments({})).toBe('');
  });

  it('parses an ai-service call log row', () => {
    const row = parseMcpCallLogEntry({
      id: 9,
      company_id: 10,
      agent_id: 'a1',
      agent_name: 'A',
      client_id: 'c1',
      client_name: 'Cursor',
      token_kind: 'agent',
      user_id: null,
      user_email: '',
      service: 'storage',
      tool_name: 'storage_list_buckets',
      wrapper_tool: 'ai_call_tool',
      operation_title: 'List buckets',
      access_kind: 'read',
      outcome: 'failed',
      resource_label: 'buckets',
      arguments: { prefix: 'uploads/' },
      status: 'failed',
      status_code: 500,
      error_code: 'upstream_error',
      error_message: 'Storage timed out.',
      duration_ms: 50,
      approval_id: 'ap-1',
      approval_channel: 'form',
      approval_outcome: 'approved',
      created_at: '2026-01-01T00:00:00Z',
      http_method: 'GET',
      path: '/api/v1/buckets',
      tool: 'list_users',
    });
    expect(row?.tool_name).toBe('storage_list_buckets');
    expect(row?.wrapper_tool).toBe('ai_call_tool');
    expect(row?.status).toBe('failed');
    expect(row?.error_message).toBe('Storage timed out.');
    expect(row?.approval_channel).toBe('form');
    expect(row?.approval_outcome).toBe('approved');
    expect(row?.status_code).toBe(500);
    expect(row?.duration_ms).toBe(50);
    expect(row).not.toHaveProperty('method');
    expect(row).not.toHaveProperty('path');
    expect(row).not.toHaveProperty('tool');
  });

  it('parses the call log page and optional global audit fields', () => {
    const page = parseMcpCallLogsResponse({
      count: 3,
      limit: 50,
      offset: 0,
      call_logs: [
        {
          id: 1,
          company_id: 10,
          agent_id: 'agent-id',
          agent_name: 'Example agent',
          service: 'storage',
          tool_name: 'storage_list_buckets',
          wrapper_tool: '',
          status: 'allowed',
          status_code: 200,
          duration_ms: 12,
          approval_channel: 'none',
          created_at: '2026-11-11T00:00:00+00:00',
          agent_audit_scope: 'global_company',
          global_agent_id: 'g-agent',
          global_company_id: 'g-co',
        },
      ],
    });
    expect(page.count).toBe(3);
    expect(page.limit).toBe(50);
    expect(page.offset).toBe(0);
    expect(page.call_logs[0]?.agent_audit_scope).toBe('global_company');
    expect(page.call_logs[0]?.global_agent_id).toBe('g-agent');
    expect(page.call_logs[0]?.global_company_id).toBe('g-co');
  });

  it('parses created_by display name from identity', () => {
    const agent = parseMcpAgent({
      id: 'x',
      name: 'n',
      created_by: { display_name: 'Sébastien Barbier' },
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(agentCreatorDisplayName(agent!)).toBe('Sébastien Barbier');
  });

  it('parses created_by_display_name fallback', () => {
    const agent = parseMcpAgent({
      id: 'x',
      name: 'n',
      created_by_display_name: 'CI bot',
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(agentCreatorDisplayName(agent!)).toBe('CI bot');
  });

  it('treats failed and error statuses as call failures', () => {
    expect(isFailedMcpCallLog({ status: 'failed' })).toBe(true);
    expect(isFailedMcpCallLog({ status: 'error' })).toBe(true);
    expect(isFailedMcpCallLog({ status: 'allowed' })).toBe(false);
    expect(isFailedMcpCallLog({ status: 'denied' })).toBe(false);
    expect(isFailedMcpCallLog({ status: 'waiting_approval' })).toBe(false);
  });

  it('parses missing call duration as null', () => {
    const row = parseMcpCallLogEntry({
      id: 1,
      agent_id: 'a1',
      tool_name: 't',
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(row?.duration_ms).toBeNull();
    expect(row?.tool_name).toBe('t');
    expect(row?.approval_channel).toBe('none');
  });

  it('builds ai-service call log query params', () => {
    expect(
      mcpCallLogListQuery({
        agent: ' a1 ',
        service: 'storage',
        status: 'failed',
        tool: ' list_objects ',
        createdAfter: '2026-11-01T00:00:00.000Z',
        limit: 500,
        offset: 40,
      }),
    ).toEqual({
      agent: 'a1',
      service: 'storage',
      tool: 'list_objects',
      status: 'failed',
      created_after: '2026-11-01T00:00:00.000Z',
      created_before: undefined,
      limit: 200,
      offset: 40,
    });
    expect(mcpCallLogListQuery({ limit: 0, offset: -3 }).limit).toBe(1);
    expect(mcpCallLogListQuery({ limit: 0, offset: -3 }).offset).toBe(0);
  });
});

describe('fetchCompanyMcpCallLogs', () => {
  afterEach(() => {
    aiUrlState.url = 'http://localhost:8006';
    vi.unstubAllGlobals();
  });

  it('reads GET /ai/v1/mcp/call-logs with the user JWT and no company_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          count: 1,
          limit: 50,
          offset: 0,
          call_logs: [
            {
              id: 4,
              company_id: 7,
              agent_id: 'a1',
              agent_name: 'Agent',
              service: 'email',
              tool_name: 'send_message',
              wrapper_tool: '',
              status: 'allowed',
              status_code: 200,
              duration_ms: 8,
              approval_channel: 'none',
              created_at: '2026-11-11T00:00:00Z',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const page = await fetchCompanyMcpCallLogs('user-jwt', 7, {
      agent: 'a1',
      service: 'email',
      status: 'allowed',
      limit: 50,
      offset: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('http://localhost:8006/ai/v1/mcp/call-logs');
    expect(parsed.searchParams.get('agent')).toBe('a1');
    expect(parsed.searchParams.get('service')).toBe('email');
    expect(parsed.searchParams.get('status')).toBe('allowed');
    expect(parsed.searchParams.get('limit')).toBe('50');
    expect(parsed.searchParams.get('offset')).toBe('0');
    expect(parsed.searchParams.has('company_id')).toBe(false);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer user-jwt');
    expect(page.count).toBe(1);
    expect(page.call_logs[0]?.tool_name).toBe('send_message');
  });

  it('does not call the network when ai-service URL is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    aiUrlState.url = null;
    await expect(fetchCompanyMcpCallLogs('user-jwt', 7)).rejects.toBeInstanceOf(
      AiServiceNotConfiguredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a missing call-log route as unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })),
    );
    await expect(fetchCompanyMcpCallLogs('user-jwt', 7)).rejects.toThrow(MCP_CALL_LOGS_UNAVAILABLE);
  });
});
