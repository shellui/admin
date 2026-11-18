import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompanyMcpCallLogEntry } from '@/lib/companyAgentsApi';
import {
  appendPersonalCallLogs,
  fetchMcpPersonalAgentCallLogs,
  fetchMcpPersonalOauthConsent,
  mergePersonalAgentActivity,
  parseMcpPersonalAgent,
  parseMcpPersonalAgentsResponse,
  parseOauthConsentActivity,
  type CreatePersonalAgentInput,
  type McpPersonalConsentRow,
} from '@/lib/personalAgentsApi';

const urls = vi.hoisted(() => ({
  ai: 'http://localhost:8006' as string | null,
  identity: 'http://localhost:8005' as string | null,
}));

vi.mock('@/lib/aiServiceUrl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/aiServiceUrl')>();
  return {
    ...actual,
    requireAiServiceBaseUrl: () => {
      if (!urls.ai) throw new actual.AiServiceNotConfiguredError();
      return urls.ai;
    },
  };
});

vi.mock('@/lib/backendUrl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backendUrl')>();
  return {
    ...actual,
    requireAuthBackendBaseUrl: () => {
      if (!urls.identity) throw new actual.AuthBackendNotConfiguredError();
      return urls.identity;
    },
  };
});

describe('personalAgentsApi types', () => {
  it('accepts create payload shape', () => {
    const input: CreatePersonalAgentInput = {
      name: 'Test',
      services: ['identity', 'storage'],
      access_mode: 'ask',
      read_level: 'safe',
      allow_destructive: false,
      expires_at: '2027-01-01T00:00:00.000Z',
    };
    expect(input.services).toHaveLength(2);
  });

  it('parses oauth and static rows and skips a row with no kind', () => {
    const agents = parseMcpPersonalAgentsResponse({
      agents: [
        {
          id: 'oauth-1',
          kind: 'oauth',
          name: 'Cursor laptop',
          access_mode: 'ask',
          read_level: 'safe',
          allow_destructive_without_asking: false,
          services_allowed: ['identity', 'storage'],
          expires_at: '2026-12-01T00:00:00Z',
          paused_at: null,
          revoked_at: null,
          is_active: true,
          created_at: '2026-06-01T00:00:00Z',
          oauth_client_id: 'client-1',
          personal_token_id: null,
        },
        {
          id: 'static-1',
          kind: 'personal',
          name: 'Static laptop',
          access_mode: 'ask',
          read_level: 'safe',
          services_allowed: ['identity'],
          is_active: true,
          created_at: '2026-05-01T00:00:00Z',
          personal_token_id: 'pt-1',
        },
        { id: 'bad', name: 'Missing kind', created_at: '2026-01-01T00:00:00Z' },
      ],
    });
    expect(agents.map((agent) => agent.kind)).toEqual(['oauth', 'personal']);
    expect(agents[0]?.services_allowed).toEqual(['identity', 'storage']);
    expect(parseMcpPersonalAgent({ id: 'x' })).toBeNull();
  });
});

function callLog(overrides: Partial<CompanyMcpCallLogEntry> = {}): CompanyMcpCallLogEntry {
  return {
    id: 1,
    company_id: 1,
    agent_id: 'agent-1',
    agent_name: 'Agent',
    client_id: '',
    client_name: '',
    token_kind: 'personal',
    user_id: null,
    user_email: '',
    service: 'storage',
    tool_name: 'storage_list_buckets',
    wrapper_tool: 'ai_call_tool',
    arguments: {},
    status: 'failed',
    status_code: 500,
    error_code: 'upstream_error',
    error_message: 'Storage timed out.',
    duration_ms: 12,
    approval_id: 'ap-1',
    approval_channel: 'form',
    approval_outcome: 'approved',
    operation_title: 'List buckets',
    access_kind: 'read',
    outcome: 'failed',
    resource_label: 'buckets',
    created_at: '2026-11-03T00:00:00Z',
    ...overrides,
  };
}

function consent(overrides: Partial<McpPersonalConsentRow> = {}): McpPersonalConsentRow {
  return {
    timestamp: '2026-11-02T00:00:00Z',
    tool: 'oauth.device.approved',
    service: 'identity',
    operationTitle: 'oauth.device.approved',
    outcome: 'allowed',
    durationMs: null,
    ...overrides,
  };
}

describe('personal agent activity', () => {
  it('keeps OAuth consent rows and drops identity tool calls', () => {
    const rows = parseOauthConsentActivity({
      agent_id: 'agent-1',
      activity: [
        {
          timestamp: '2026-11-02T00:00:00Z',
          tool: 'oauth.device.approved',
          service: 'identity',
          outcome: 'allowed',
          company_name: 'Acme',
          client_ip: '203.0.113.1',
        },
        {
          timestamp: '2026-11-01T00:00:00Z',
          tool: 'tools/list',
          service: 'ai',
          result: 'ok',
          outcome: 'allowed',
        },
        {
          timestamp: '2026-10-01T00:00:00Z',
          tool: 'oauth.authorize.approved',
          service: 'identity',
        },
      ],
    });
    expect(rows.map((row) => row.tool)).toEqual([
      'oauth.device.approved',
      'oauth.authorize.approved',
    ]);
    expect(rows[0]).not.toHaveProperty('companyName');
    expect(rows[0]).not.toHaveProperty('clientIp');
  });

  it('merges call logs and consent rows by time, newest first', () => {
    const merged = mergePersonalAgentActivity(
      [
        callLog({ id: 2, created_at: '2026-11-01T00:00:00Z', tool_name: 'older_tool' }),
        callLog({ id: 1, created_at: '2026-11-03T00:00:00Z', tool_name: 'newer_tool' }),
      ],
      [consent()],
    );
    expect(
      merged.map((entry) => (entry.kind === 'call' ? entry.call.tool_name : entry.consent.tool)),
    ).toEqual(['newer_tool', 'oauth.device.approved', 'older_tool']);
  });

  it('appends the next call-log page without duplicating ids', () => {
    const next = appendPersonalCallLogs(
      [callLog({ id: 1 })],
      [callLog({ id: 1 }), callLog({ id: 2 })],
    );
    expect(next.map((row) => row.id)).toEqual([1, 2]);
  });
});

describe('fetchMcpPersonalAgentCallLogs', () => {
  afterEach(() => {
    urls.ai = 'http://localhost:8006';
    urls.identity = 'http://localhost:8005';
    vi.unstubAllGlobals();
  });

  it('reads the personal call-log route with the app JWT and treats 404 as empty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            count: 2,
            limit: 1,
            offset: 0,
            call_logs: [
              {
                id: 4,
                service: 'email',
                tool_name: 'send_message',
                wrapper_tool: 'ai_call_tool',
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
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchMcpPersonalAgentCallLogs('user-jwt', 'agent-1', {
      service: 'email',
      status: 'allowed',
      limit: 1,
      offset: 0,
    });
    const second = await fetchMcpPersonalAgentCallLogs('user-jwt', 'agent-1', {
      limit: 1,
      offset: 1,
    });

    expect(first.call_logs[0]?.tool_name).toBe('send_message');
    expect(first.call_logs[0]?.wrapper_tool).toBe('ai_call_tool');
    expect(first.count).toBe(2);
    expect(second).toEqual({ count: 0, limit: 1, offset: 1, call_logs: [] });

    const firstUrl = new URL((fetchMock.mock.calls[0] as [string, RequestInit])[0]);
    expect(firstUrl.origin + firstUrl.pathname).toBe(
      'http://localhost:8006/ai/v1/mcp/personal/agents/agent-1/call-logs',
    );
    expect(firstUrl.searchParams.get('service')).toBe('email');
    expect(firstUrl.searchParams.get('limit')).toBe('1');
    expect(firstUrl.searchParams.get('offset')).toBe('0');
    expect(firstUrl.searchParams.has('company_id')).toBe(false);
    expect(firstUrl.searchParams.has('agent')).toBe(false);
    expect(
      new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers).get(
        'Authorization',
      ),
    ).toBe('Bearer user-jwt');

    const secondUrl = new URL((fetchMock.mock.calls[1] as [string])[0]);
    expect(secondUrl.searchParams.get('offset')).toBe('1');
  });

  it('does not call the network when the ai-service URL is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    urls.ai = null;
    await expect(fetchMcpPersonalAgentCallLogs('user-jwt', 'agent-1')).rejects.toMatchObject({
      name: 'AiServiceNotConfiguredError',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads only OAuth consent rows from identity activity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          agent_id: 'agent-1',
          activity: [
            {
              timestamp: '2026-11-02T00:00:00Z',
              tool: 'tools/list',
              service: 'ai',
              outcome: 'allowed',
            },
            {
              timestamp: '2026-11-01T00:00:00Z',
              tool: 'oauth.authorize.approved',
              service: 'identity',
              outcome: 'allowed',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const rows = await fetchMcpPersonalOauthConsent('user-jwt', 7, 'agent-1');
    expect(rows.map((row) => row.tool)).toEqual(['oauth.authorize.approved']);
    const url = new URL((fetchMock.mock.calls[0] as [string])[0]);
    expect(url.pathname).toBe('/api/v1/mcp/personal/agents/agent-1/activity');
    expect(url.searchParams.get('company_id')).toBe('7');
  });
});
