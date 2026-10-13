import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOAuthSocialApp, updateOAuthClient } from '@/lib/adminOauthClientsApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('oauth application payloads', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not send desktop_redirect_scheme on social app create or client update', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        id: 4,
        provider: 'github',
        name: 'GitHub',
        label: 'GitHub',
        client_id: 'cid',
        tenant: '',
        is_active: true,
        is_linked: true,
        mapping_id: 9,
        mapping_is_active: true,
        created_at: '2026-10-13T00:00:00Z',
        updated_at: '2026-10-13T00:00:00Z',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createOAuthSocialApp('tok', 1, {
      docs_slug: 'github',
      client_id: 'cid',
      client_secret: 'secret',
    });
    await updateOAuthClient('tok', 9, { is_active: false });

    const createBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const updateBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(createBody.desktop_redirect_scheme).toBeUndefined();
    expect(updateBody).toEqual({ is_active: false });
    expect(updateBody.desktop_redirect_scheme).toBeUndefined();
  });
});
