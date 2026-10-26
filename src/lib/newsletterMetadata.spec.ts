import { describe, expect, it } from 'vitest';
import { parseSubscriber } from '@/lib/emailNewsletters';
import { parseIdentityRule, toIdentityRuleWriteBody } from '@/lib/actionsApiParsers';
import { listConfiguredWebhookServices } from '@/lib/webhookServices';

const base = {
  id: 1,
  email: 'ada@example.com',
  first_name: 'Ada',
  language: 'en',
  status: 'pending',
  source: 'form',
  created_at: '2026-10-26T10:00:00Z',
  confirmed_at: null,
  unsubscribed_at: null,
};

describe('subscriber metadata', () => {
  it('keeps string values and drops everything else', () => {
    const row = parseSubscriber({
      ...base,
      metadata: { company: 'Zebulon', notes: 'line one\nline two', bad: 3 },
    });
    expect(row.metadata).toEqual({ company: 'Zebulon', notes: 'line one\nline two' });
  });

  it('defaults to an empty object', () => {
    expect(parseSubscriber(base).metadata).toEqual({});
    expect(parseSubscriber({ ...base, metadata: 'x' }).metadata).toEqual({});
  });
});

describe('email webhook newsletter filter', () => {
  it('sends newsletter_id, including null to clear it', () => {
    expect(
      toIdentityRuleWriteBody({ config: { url: 'https://h.example', newsletter_id: 4 } }),
    ).toMatchObject({ newsletter_id: 4 });
    expect(
      toIdentityRuleWriteBody({ config: { url: 'https://h.example', newsletter_id: null } }),
    ).toMatchObject({ newsletter_id: null });
    expect(toIdentityRuleWriteBody({ config: { url: 'https://h.example' } })).not.toHaveProperty(
      'newsletter_id',
    );
  });

  it('reads newsletter_id from the masked config', () => {
    const rule = parseIdentityRule({
      id: 9,
      name: 'r',
      event_type: 'email.newsletter.confirmed',
      enabled: true,
      config: { url: 'https://h.example', newsletter_id: 4 },
      created_at: '',
      updated_at: '',
    });
    expect(rule.config.newsletter_id).toBe(4);
  });

  it('lists email as a webhook service only when the email admin is enabled', () => {
    const on = listConfiguredWebhookServices({
      email: { url: 'https://email.example' } as never,
    }).find((s) => s.key === 'email');
    expect(on?.labelKey).toBe('webhooksServiceEmail');
  });
});
