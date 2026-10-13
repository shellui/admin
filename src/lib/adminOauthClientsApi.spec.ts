import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createOAuthSocialApp,
  fetchOAuthClients,
  fetchOAuthSocialApps,
  updateOAuthClient,
  updateOAuthSocialApp,
} from '@/lib/adminOauthClientsApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('oauth application desktop_redirect_scheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses the scheme on social apps and oauth clients', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/oauth-social-apps')) {
        return jsonResponse({
          providers: ['github'],
          social_apps: [
            {
              id: 4,
              provider: 'github',
              name: 'GitHub',
              client_id: 'cid',
              is_linked: true,
              mapping_id: 9,
              mapping_is_active: true,
              desktop_redirect_scheme: 'shellui-playground',
            },
            {
              id: 5,
              provider: 'google',
              name: 'Google',
              client_id: 'gid',
              is_linked: true,
              mapping_id: 10,
              mapping_is_active: true,
            },
          ],
        });
      }
      return jsonResponse([
        {
          id: 9,
          provider: 'github',
          label: 'GitHub',
          client_id: 'cid',
          tenant: '',
          is_active: true,
          created_at: '2026-10-13T00:00:00Z',
          updated_at: '2026-10-13T00:00:00Z',
          desktop_redirect_scheme: 'shellui-playground',
        },
      ]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const apps = await fetchOAuthSocialApps('tok', 1);
    expect(apps.social_apps[0]?.desktop_redirect_scheme).toBe('shellui-playground');
    expect(apps.social_apps[1]?.desktop_redirect_scheme).toBe('');

    const clients = await fetchOAuthClients('tok');
    expect(clients[0]?.desktop_redirect_scheme).toBe('shellui-playground');
  });

  it('sends the scheme on social app create and update', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        id: 4,
        provider: 'github',
        name: 'GitHub',
        client_id: 'cid',
        is_linked: true,
        mapping_id: 9,
        mapping_is_active: true,
        desktop_redirect_scheme: 'shellui-playground',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createOAuthSocialApp('tok', 1, {
      docs_slug: 'github',
      client_id: 'cid',
      client_secret: 'secret',
      desktop_redirect_scheme: 'shellui-playground',
    });
    await updateOAuthSocialApp('tok', 1, 4, { desktop_redirect_scheme: '' });

    const createBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const updateBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(createBody.desktop_redirect_scheme).toBe('shellui-playground');
    expect(updateBody).toEqual({ desktop_redirect_scheme: '' });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/v1/oauth-social-apps/4');
  });

  it('sends the scheme on oauth client update', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        id: 9,
        provider: 'github',
        label: 'GitHub',
        client_id: 'cid',
        tenant: '',
        is_active: true,
        created_at: '2026-10-13T00:00:00Z',
        updated_at: '2026-10-13T00:00:00Z',
        desktop_redirect_scheme: '',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const row = await updateOAuthClient('tok', 9, { desktop_redirect_scheme: '' });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/oauth-clients/9');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ desktop_redirect_scheme: '' });
    expect(row.desktop_redirect_scheme).toBe('');
  });
});
