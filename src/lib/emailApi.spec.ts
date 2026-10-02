import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmailApiClient } from '@/lib/emailApi';
import { EmailApiError } from '@/lib/emailApiErrors';

describe('createEmailApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls admin routes with the identity JWT and company_id', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url.startsWith('https://email.shellui.com/api/v1/rules')).toBe(true);
      expect(url).toContain('company_id=42');
      return new Response(
        JSON.stringify({
          company_id: 42,
          rules: [
            {
              event_type: 'hosting.deployment.failed',
              service: 'hosting',
              template_key: 'hosting.deployment.failed',
              enabled: true,
              language: '',
              recipient_mode: 'hints',
              static_recipients: [],
              customized: false,
              default_enabled: true,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createEmailApiClient('https://email.shellui.com/', 'jwt-token', 42);
    const rules = await client.fetchRules();

    expect(rules).toHaveLength(1);
    expect(rules[0]?.service).toBe('hosting');
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer jwt-token');
  });

  it('omits credentials on provider save when the caller does not send them', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          company_id: 42,
          configured: true,
          provider: 'resend',
          from_email: 'no-reply@acme.com',
          credentials_hint: '••••abcd',
          fallback_provider: 'resend',
          fallback_configured: true,
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = createEmailApiClient('https://email.shellui.com', 'jwt-token', 42);
    const saved = await client.saveProvider({
      provider: 'resend',
      from_email: 'no-reply@acme.com',
      from_name: 'Acme',
      sending_domain: 'acme.com',
      bulk_from_email: '',
    });

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty('credentials');
    expect(body).not.toHaveProperty('api_key');
    expect(saved.credentialsHint).toBe('••••abcd');
    expect(JSON.stringify(saved)).not.toContain('re_');
    expect(saved.smtpAllowed).toBe(false);
    expect(saved.authLinkHosts).toEqual([]);
  });

  it('reopens one template version and sends the editor draft on send-test', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/versions/2') && (!init || !init.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            number: 2,
            state: 'published',
            subject: 'Hello',
            preheader: 'Preview',
            document: { preview: 'Preview', blocks: [{ type: 'text', text: 'Hi' }] },
            theme_name: 'shellui',
            theme_palette: { background: '#ffffff' },
            published_at: null,
          }),
          { status: 200 },
        );
      }
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.document).toBeTruthy();
      expect(body.subject).toBe('Hello');
      expect(body).not.toHaveProperty('to');
      return new Response(
        JSON.stringify({ status: 'sent', provider: 'resend', provider_message_id: 're_1' }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = createEmailApiClient('https://email.shellui.com', 'jwt-token', 42);
    const version = await client.fetchVersion(11, 2);
    expect(version.document.blocks[0]?.text).toBe('Hi');
    expect(version.themeName).toBe('shellui');
    await client.sendTemplateTest(11, {
      document: version.document,
      subject: 'Hello',
      preheader: 'Preview',
      theme_palette: { background: '#ffffff' },
    });
  });

  it('reads auth_link_hosts from the catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ auth_link_hosts: ['id.shellui.com'], events: [] }), {
          status: 200,
        });
      }),
    );
    const client = createEmailApiClient('https://email.shellui.com', 'jwt-token', 42);
    const catalog = await client.fetchCatalog();
    expect(catalog.authLinkHosts).toEqual(['id.shellui.com']);
    expect(catalog.events).toEqual([]);
  });

  it('reads smtp_allowed and skipped stats from the contract', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/provider')) {
        return new Response(JSON.stringify({ configured: false, smtp_allowed: true }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({
          company_id: 42,
          from: '2026-09-02T00:00:00Z',
          to: '2026-10-02T00:00:00Z',
          totals: { sent: 1, delivered: 1, bounced: 0, complained: 0, expired: 0, failed: 0 },
          skipped: { total: 4, no_recipients: 1, rule_disabled: 3 },
          by_lane: {},
          by_event: {},
          by_day: [],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = createEmailApiClient('https://email.shellui.com', 'jwt-token', 42);
    expect((await client.fetchProvider()).smtpAllowed).toBe(true);
    const stats = await client.fetchStats();
    expect(stats.skipped).toEqual({ total: 4, noRecipients: 1, ruleDisabled: 3 });
  });

  it('maps error_code and ignores translated API prose', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error_code: 'provider_not_configured',
            detail: 'Please configure a provider before sending.',
            message: 'Configure the provider.',
          }),
          { status: 409 },
        );
      }),
    );
    const client = createEmailApiClient('https://email.shellui.com', 'jwt-token', 42);
    await expect(client.fetchProvider()).rejects.toMatchObject({
      name: 'EmailApiError',
      errorCode: 'provider_not_configured',
      status: 409,
    });
    try {
      await client.fetchProvider();
    } catch (error) {
      expect(error).toBeInstanceOf(EmailApiError);
      expect((error as EmailApiError).message).toBe('provider_not_configured');
      expect((error as EmailApiError).message).not.toContain('Please');
    }
  });

  it('reads field_errors codes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error_code: 'validation_failed',
            field_errors: { from_email: ['invalid_format'] },
          }),
          { status: 400 },
        );
      }),
    );
    const client = createEmailApiClient('https://email.shellui.com', 'jwt-token', 42);
    await expect(
      client.saveProvider({
        provider: 'resend',
        from_email: 'nope',
        from_name: '',
        sending_domain: '',
        bulk_from_email: '',
      }),
    ).rejects.toMatchObject({
      errorCode: 'validation_failed',
      fieldErrors: { from_email: ['invalid_format'] },
    });
  });
});
