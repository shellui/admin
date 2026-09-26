import { describe, expect, it } from 'vitest';
import { eventDefaultEmailTemplateRequest } from '@/lib/actionsApiPaths';
import {
  buildEventTemplateVariables,
  isUrlLikeTemplateField,
  parseDeliveriesList,
  parseEmailTemplate,
  parseEventsList,
  parseIdentityRule,
  parseRulesList,
  toIdentityRuleWriteBody,
} from '@/lib/actionsApiParsers';

describe('eventDefaultEmailTemplateRequest', () => {
  it('builds nested event path and query fallback', () => {
    const attempts = eventDefaultEmailTemplateRequest('identity.user.created', 'fr');
    expect(attempts[0].path).toBe('/api/v1/actions/events/identity.user.created/email-template');
    expect(attempts[0].query).toEqual({ language: 'fr' });
    expect(attempts[1]).toEqual({
      path: '/api/v1/actions/email-template',
      query: { event_type: 'identity.user.created', language: 'fr' },
    });
  });
});

describe('actionsApi parsers', () => {
  it('parseEmailTemplate maps identity html field', () => {
    expect(parseEmailTemplate({ subject: 'Hi', html: '<p>a</p>' })).toEqual({
      subject: 'Hi',
      html: '<p>a</p>',
    });
  });

  it('parseEmailTemplate still accepts body_html', () => {
    expect(parseEmailTemplate({ subject: 'Hi', body_html: '<p>a</p>' })).toEqual({
      subject: 'Hi',
      html: '<p>a</p>',
    });
  });

  it('parseEmailTemplate maps document json', () => {
    const document = { type: 'doc', content: [{ type: 'paragraph' }] };
    expect(parseEmailTemplate({ subject: 'Hi', html: '<p>a</p>', document })).toEqual({
      subject: 'Hi',
      html: '<p>a</p>',
      document,
    });
  });

  it('parseRulesList reads identity results envelope', () => {
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
      ],
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].event).toBe('identity.user.created');
    expect(rules[0].kind).toBe('email');
    expect(rules[0].config).toMatchObject({ recipients: ['ops@example.com'] });
  });

  it('parseEventsList reads identity results envelope', () => {
    const events = parseEventsList({
      results: [
        {
          type: 'identity.user.created',
          label: 'User created',
          payload_email_field: 'email',
          payload_fields: [{ name: 'email', description: 'User email address' }],
        },
      ],
    });
    expect(events[0].key).toBe('identity.user.created');
    const tokens = events[0].template_variables?.map((v) => v.token) ?? [];
    expect(tokens).toContain('data.email');
    expect(tokens).toContain('envelope.company.name');
  });

  it('buildEventTemplateVariables includes magic link URL with isUrl', () => {
    const vars = buildEventTemplateVariables({
      type: 'identity.auth.magic_link.requested',
      payload_fields: [{ name: 'email', description: 'Recipient email' }],
      email_template_fields: [
        {
          name: 'magic_link_url',
          description: 'Sign-in URL injected when the email is sent',
        },
      ],
    });
    const magic = vars.find((v) => v.token === 'data.magic_link_url');
    expect(magic).toBeDefined();
    expect(magic?.isUrl).toBe(true);
    expect(isUrlLikeTemplateField('magic_link_url', magic?.description)).toBe(true);
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
          action_rule_name: 'Ops mail',
          status: 'failed',
          attempt_count: 2,
          last_error: 'smtp down',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T01:00:00Z',
        },
      ],
    });
    expect(parsed.count).toBe(1);
    expect(parsed.results[0].id).toBe('550e8400-e29b-41d4-a716-446655440099');
    expect(parsed.results[0].event).toBe('identity.user.created');
    expect(parsed.results[0].rule_id).toBe(3);
    expect(parsed.results[0].attempts_count).toBe(2);
  });

  it('toIdentityRuleWriteBody includes document and theme_id', () => {
    const document = { type: 'doc', content: [{ type: 'paragraph' }] };
    const body = toIdentityRuleWriteBody({
      name: 'Ops',
      event: 'identity.user.created',
      kind: 'email',
      config: {
        recipients: ['ops@example.com'],
        email_templates: {
          en: { subject: 'Hi', html: '<p>x</p>', document, theme_id: 'shellui-light' },
        },
      },
    });
    const templates = body.email_templates as Record<string, unknown>;
    expect(templates.en).toEqual({
      subject: 'Hi',
      html: '<p>x</p>',
      document,
      theme_id: 'shellui-light',
    });
  });

  it('toIdentityRuleWriteBody flattens email rule for POST', () => {
    const body = toIdentityRuleWriteBody({
      name: 'Ops',
      event: 'identity.user.created',
      kind: 'email',
      config: {
        recipients: ['ops@example.com'],
        include_payload_email: true,
        email_templates: {
          en: { subject: 'Hi', html: '<p>x</p>' },
        },
      },
    });
    expect(body.event_type).toBe('identity.user.created');
    expect(body.action_kind).toBe('email');
    expect(body.recipients).toEqual(['ops@example.com']);
    expect(body.email_templates).toEqual({ en: { subject: 'Hi', html: '<p>x</p>' } });
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
