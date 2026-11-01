import { describe, expect, it } from 'vitest';
import {
  formatApprovalArgumentsForConfirm,
  isDestructiveMcpApproval,
  parseMcpAgent,
  parseMcpAgentsResponse,
  parseMcpApproval,
  parseMcpCallLogEntry,
} from '@/lib/companyAgentsApi';

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

  it('parses approval with redacted arguments alias', () => {
    const row = parseMcpApproval({
      id: 'p1',
      agent_id: 'a1',
      agent_name: 'Agent',
      service: 'storage',
      action: 'delete_object',
      arguments_hash: 'hash',
      arguments_redacted: { key: 'x' },
      expires_at: '2026-01-01T00:10:00Z',
    });
    expect(row?.arguments).toEqual({ key: 'x' });
    expect(isDestructiveMcpApproval(row!)).toBe(true);
  });

  it('formats confirm payload with hash when args missing', () => {
    const json = formatApprovalArgumentsForConfirm({
      id: '1',
      agent_id: 'a',
      agent_name: 'A',
      service: 'identity',
      action: 'patch_user',
      arguments_hash: 'abc',
      expires_at: '2026-01-01T00:00:00Z',
    });
    expect(json).toContain('arguments_hash');
  });

  it('parses call log entry', () => {
    const row = parseMcpCallLogEntry({
      id: 9,
      agent_id: 'a1',
      agent_name: 'A',
      service: 'identity',
      tool: 'list_users',
      http_method: 'GET',
      path: '/api/v1/users',
      status_code: 200,
      duration_ms: 50,
      arguments: {},
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(row?.method).toBe('GET');
    expect(row?.status_code).toBe(200);
  });
});
