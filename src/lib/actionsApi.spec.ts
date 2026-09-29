import { describe, expect, it } from 'vitest';
import {
  parseDeliveriesList,
  parseEventsList,
  parseIdentityRule,
  parseRulesList,
  toIdentityRuleWriteBody,
} from '@/lib/actionsApiParsers';

describe('actionsApi parsers', () => {
  it('parseRulesList reads identity results envelope and legacy email rules', () => {
    const rules = parseRulesList({
      results: [
        {
          id: 12,
          name: 'Ops mail',
          event_type: 'identity.user.created',
          action_kind: 'email',
          enabled: true,
          config: { recipients: ['ops@example.com'], include_payload_email: false },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
        },
        {
          id: 13,
          name: 'Hook',
          event_type: 'identity.group.created',
          action_kind: 'webhook',
          enabled: true,
          config: { url: 'https://hooks.example.com' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    expect(rules).toHaveLength(2);
    expect(rules[0].kind).toBe('email');
    expect(rules[1].kind).toBe('webhook');
  });

  it('parseEventsList reads identity event catalog', () => {
    const events = parseEventsList({
      results: [
        {
          type: 'identity.user.created',
          label: 'User created',
          description: 'Fires when a user is created',
        },
      ],
    });
    expect(events[0].key).toBe('identity.user.created');
    expect(events[0].label).toBe('User created');
  });

  it('parseDeliveriesList maps identity delivery fields', () => {
    const parsed = parseDeliveriesList({
      count: 1,
      page: 1,
      page_size: 20,
      results: [
        {
          id: '550e8400-e29b-41d4-a716-446655440099',
          event_type: 'identity.user.created',
          action_rule_id: 3,
          action_rule_name: 'Ops hook',
          status: 'failed',
          attempt_count: 2,
          last_error: 'connection refused',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T01:00:00Z',
        },
      ],
    });
    expect(parsed.count).toBe(1);
    expect(parsed.results[0].event).toBe('identity.user.created');
    expect(parsed.results[0].attempts_count).toBe(2);
  });

  it('toIdentityRuleWriteBody flattens webhook rule for POST', () => {
    const body = toIdentityRuleWriteBody({
      name: 'Hook',
      event: 'identity.user.created',
      kind: 'webhook',
      config: {
        url: 'https://hooks.example.com',
        secret: 'shhh',
        auth_header_name: 'Authorization',
        auth_header_value: 'Bearer token',
      },
    });
    expect(body.event_type).toBe('identity.user.created');
    expect(body.action_kind).toBe('webhook');
    expect(body.url).toBe('https://hooks.example.com');
    expect(body.secret).toBe('shhh');
    expect(body.authorization_header).toBe('Authorization: Bearer token');
  });

  it('parseIdentityRule maps webhook config flags', () => {
    const rule = parseIdentityRule({
      id: 9,
      name: 'Hook',
      event_type: 'identity.group.created',
      action_kind: 'webhook',
      enabled: true,
      config: {
        url: 'https://hooks.example.com',
        secret_set: true,
        authorization_header_set: true,
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    expect(rule.kind).toBe('webhook');
    expect(rule.config).toMatchObject({
      url: 'https://hooks.example.com',
      secret_set: true,
      authorization_header_set: true,
    });
  });
});
