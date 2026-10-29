import { describe, expect, it } from 'vitest';
import {
  parseDeliveriesList,
  parseDeliveryDetail,
  parseEventsList,
  parseIdentityRule,
  parseRulesList,
  parseSendTestResult,
} from '@/lib/actionsApiParsers';

const emailRule = {
  id: 7,
  company_id: 1,
  name: 'Signups',
  description: '',
  event_type: 'email.newsletter.subscribed',
  enabled: true,
  action_kind: 'webhook',
  config: { url: 'https://hooks.example.com/a', has_secret: true, secret_hint: 'abcd' },
  created_at: '2026-10-29T10:00:00+00:00',
  updated_at: '2026-10-29T10:00:00+00:00',
};

describe('email-service actions shapes', () => {
  it('parses the rules list under `rules`', () => {
    const rules = parseRulesList({ rules: [emailRule] });
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ id: 7, event: 'email.newsletter.subscribed', enabled: true });
    expect(rules[0].config).toMatchObject({
      url: 'https://hooks.example.com/a',
      has_secret: true,
      secret_hint: 'abcd',
    });
  });

  it('parses events with `id` keys', () => {
    const events = parseEventsList({
      events: [{ id: 'email.sent', label: 'Email sent', description: 'Sent.' }],
    });
    expect(events).toEqual([{ key: 'email.sent', label: 'Email sent', description: 'Sent.' }]);
  });

  it('parses deliveries under `deliveries`', () => {
    const list = parseDeliveriesList({
      deliveries: [
        {
          id: '12',
          company_id: 1,
          action_rule_id: 7,
          event_type: 'email.sent',
          status: 'failed',
          attempt_count: 2,
          last_error: 'timeout',
          created_at: '2026-10-29T10:00:00+00:00',
        },
      ],
    });
    expect(list.count).toBe(1);
    expect(list.results[0]).toMatchObject({
      id: '12',
      rule_id: 7,
      attempts_count: 2,
      status: 'failed',
    });
  });

  it('parses delivery attempts without id, using attempt_number and error_code', () => {
    const detail = parseDeliveryDetail({
      id: '12',
      status: 'failed',
      attempts: [
        {
          attempt_number: 1,
          status: 'failure',
          http_status: 500,
          error_code: 'http_500',
          trigger: null,
        },
      ],
      envelope: { id: 'evt' },
    });
    expect(detail.attempts[0]).toMatchObject({ id: 1, error: 'http_500', response_status: 500 });
    expect(detail.payload).toEqual({ id: 'evt' });
  });

  it('accepts the queued send-test response', () => {
    expect(parseSendTestResult({ status: 'queued' })).toEqual({
      ok: true,
      webhook_id: '',
      event_type: '',
      queued: true,
    });
  });

  it('parses a create response with a revealed secret', () => {
    expect(parseIdentityRule({ ...emailRule, secret: 'whsec_x' }).id).toBe(7);
  });
});

describe('identity, hosting and storage actions shapes', () => {
  it('parses `results` lists and `type` events', () => {
    expect(parseRulesList({ results: [emailRule] })).toHaveLength(1);
    expect(parseEventsList({ results: [{ type: 'user.created', label: 'User' }] })[0].key).toBe(
      'user.created',
    );
  });

  it('parses paginated deliveries and attempts', () => {
    const list = parseDeliveriesList({
      count: 30,
      page: 1,
      results: [
        {
          id: '1',
          status: 'delivered',
          action_rule_id: 3,
          action_rule_name: 'R',
          attempt_count: 1,
        },
      ],
    });
    expect(list.count).toBe(30);
    expect(list.results[0].rule_name).toBe('R');
    const detail = parseDeliveryDetail({
      id: '1',
      status: 'delivered',
      attempts: [
        { id: 9, attempt_number: 1, status: 'failure', error_message: 'boom', http_status: 502 },
      ],
    });
    expect(detail.attempts[0]).toMatchObject({ id: 9, error: 'boom', response_status: 502 });
  });

  it('parses the inline send-test response', () => {
    expect(
      parseSendTestResult({ ok: true, webhook_id: 'msg_1', event_type: 'user.created' }),
    ).toEqual({
      ok: true,
      webhook_id: 'msg_1',
      event_type: 'user.created',
    });
  });

  it('still rejects unknown shapes', () => {
    expect(() => parseRulesList({ items: [] })).toThrow('Unexpected actions rules response.');
    expect(() => parseSendTestResult({ status: 'nope' })).toThrow();
  });
});
