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
