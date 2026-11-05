import { describe, expect, it } from 'vitest';
import {
  formatApprovalArgumentsForConfirm,
  formatCallLogArguments,
  isDestructiveMcpApproval,
  mcpApprovalHasRedactedArguments,
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
    expect(row?.duration_ms).toBe(50);
  });

  it('parses missing call duration as null', () => {
    const row = parseMcpCallLogEntry({
      id: 1,
      agent_id: 'a1',
      tool: 't',
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(row?.duration_ms).toBeNull();
  });
});
