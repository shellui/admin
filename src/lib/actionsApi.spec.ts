import { describe, expect, it } from 'vitest';
import {
  parseDeliveriesList,
  parseEventsList,
  parseIdentityRule,
  parseRulesList,
  parseSendTestResult,
  toIdentityRuleWriteBody,
} from '@/lib/actionsApiParsers';

describe('actionsApi parsers', () => {
  it('parseRulesList reads identity webhook rules without action_kind', () => {
    const rules = parseRulesList({
      results: [
        {
          id: 13,
          name: 'Hook',
          event_type: 'identity.group.created',
          enabled: true,
          config: { url: 'https://hooks.example.com' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].event).toBe('identity.group.created');
    expect(rules[0].config.url).toBe('https://hooks.example.com');
  });

  it('parseIdentityRule rejects non-webhook action_kind', () => {
    expect(() =>
      parseIdentityRule({
        id: 1,
        event_type: 'identity.user.created',
        action_kind: 'email',
        config: {},
      }),
    ).toThrow();
  });

  it('parseEventsList maps sample_envelope from identity catalog', () => {
    const envelope = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'identity.user.created',
      company: { id: 1, slug: 'acme', name: 'Acme' },
      data: { email: 'ada@acme.com' },
    };
    const events = parseEventsList({
      results: [
        {
          type: 'identity.user.created',
          label: 'User created',
          description: 'Fires when a user is created',
          sample_envelope: envelope,
        },
      ],
    });
    expect(events[0].key).toBe('identity.user.created');
    expect(events[0].sample_envelope).toEqual(envelope);
  });

  it('parseSendTestResult maps identity send-test payload', () => {
    expect(
      parseSendTestResult({
        ok: true,
        webhook_id: '550e8400-e29b-41d4-a716-446655440099',
        event_type: 'identity.user.created',
      }),
    ).toEqual({
      ok: true,
      webhook_id: '550e8400-e29b-41d4-a716-446655440099',
      event_type: 'identity.user.created',
    });
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

  it('toIdentityRuleWriteBody omits action_kind for webhook POST', () => {
    const body = toIdentityRuleWriteBody({
      name: 'Hook',
      event: 'identity.user.created',
      config: {
        url: 'https://hooks.example.com',
        secret: 'shhh',
        auth_header_name: 'Authorization',
        auth_header_value: 'Bearer token',
      },
    });
    expect(body.event_type).toBe('identity.user.created');
    expect(body.action_kind).toBeUndefined();
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
    expect(rule.config).toMatchObject({
      url: 'https://hooks.example.com',
      secret_set: true,
      authorization_header_set: true,
    });
  });
});
