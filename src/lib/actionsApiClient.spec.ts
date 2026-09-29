import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActionsApiClient } from '@/lib/actionsApi';

describe('createActionsApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls hosting and storage base URLs with company_id and bearer token', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain('/api/v1/actions/rules');
      expect(url).toContain('company_id=7');
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createActionsApiClient('https://host.example.com', 'token-abc', 7, 'hosting');
    await client.fetchRules();

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit?];
    const requestUrl = String(call[0]);
    const init = call[1];
    expect(requestUrl.startsWith('https://host.example.com/api/v1/actions/rules')).toBe(true);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token-abc');
  });

  it('maps 404 to ApiUnavailableError with storage message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })),
    );

    const client = createActionsApiClient('https://storage.example.com', 'token-abc', 1, 'storage');

    await expect(client.fetchEvents()).rejects.toMatchObject({
      name: 'ApiUnavailableError',
      message: expect.stringContaining('storage'),
    });
  });
});
