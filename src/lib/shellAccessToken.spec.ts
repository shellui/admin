import { afterEach, describe, expect, it, vi } from 'vitest';

const sendMessageToParent = vi.hoisted(() => vi.fn());
vi.mock('@shellui/sdk', () => ({ sendMessageToParent }));
import {
  SessionExpiredError,
  bearerFetch,
  freshShellAccessToken,
  isSameShellSession,
  setLatestShellAccessToken,
  shellAccessTokenIdentity,
} from '@/lib/shellAccessToken';

function jwt(claims: Record<string, unknown>): string {
  const body = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `h.${body}.s`;
}

describe('shellAccessToken', () => {
  afterEach(() => setLatestShellAccessToken(null));

  it('ignores exp, iat, nbf and jti when comparing sessions', () => {
    const a = jwt({ sub: '1', company_id: 7, exp: 10, iat: 1, nbf: 1, jti: 'a' });
    const b = jwt({ company_id: 7, sub: '1', exp: 20, iat: 2, nbf: 2, jti: 'b' });
    expect(shellAccessTokenIdentity(a)).toBe(shellAccessTokenIdentity(b));
    expect(isSameShellSession(a, b)).toBe(true);
  });

  it('treats other users, companies, roles and opaque tokens as a new session', () => {
    const a = jwt({ sub: '1', company_id: 7, exp: 10 });
    expect(isSameShellSession(a, jwt({ sub: '2', company_id: 7, exp: 10 }))).toBe(false);
    expect(isSameShellSession(a, jwt({ sub: '1', company_id: 8, exp: 10 }))).toBe(false);
    expect(isSameShellSession(a, jwt({ sub: '1', company_id: 7, is_staff: true, exp: 10 }))).toBe(
      false,
    );
    expect(isSameShellSession('opaque', 'other')).toBe(false);
    expect(isSameShellSession(a, null)).toBe(false);
  });

  it('sends the newest renewal of the same session only', () => {
    const old = jwt({ sub: '1', company_id: 7, exp: 10 });
    const renewed = jwt({ sub: '1', company_id: 7, exp: 20 });
    const stranger = jwt({ sub: '2', company_id: 7, exp: 10 });
    expect(freshShellAccessToken(old)).toBe(old);

    setLatestShellAccessToken(renewed);
    expect(freshShellAccessToken(old)).toBe(renewed);
    expect(freshShellAccessToken(stranger)).toBe(stranger);

    setLatestShellAccessToken(null);
    expect(freshShellAccessToken(old)).toBe(old);
  });
});

describe('bearerFetch', () => {
  afterEach(() => {
    setLatestShellAccessToken(null);
    vi.unstubAllGlobals();
  });

  function stubFetch(statuses: number[]) {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(new Headers(init.headers).get('Authorization') ?? '');
        return new Response(null, { status: statuses.shift() ?? 200 });
      }),
    );
    return calls;
  }

  it('asks the shell for a fresh token on 401 and retries once with it', async () => {
    const old = jwt({ sub: '1', exp: 10 });
    const renewed = jwt({ sub: '1', exp: 20 });
    setLatestShellAccessToken(old);
    sendMessageToParent.mockImplementation(() => setLatestShellAccessToken(renewed));
    const calls = stubFetch([401, 200]);

    const res = await bearerFetch('https://api.example/x', {}, old);

    expect(res.status).toBe(200);
    expect(calls).toEqual([`Bearer ${old}`, `Bearer ${renewed}`]);
    expect(sendMessageToParent).toHaveBeenCalledWith({
      type: 'SHELLUI_SETTINGS_REQUESTED',
      payload: {},
    });
  });

  it('throws SessionExpiredError when no newer token arrives', async () => {
    vi.useFakeTimers();
    const old = jwt({ sub: '1', exp: 10 });
    sendMessageToParent.mockImplementation(() => {});
    const calls = stubFetch([401]);

    const done = expect(bearerFetch('https://api.example/x', {}, old)).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    await vi.advanceTimersByTimeAsync(5000);
    await done;
    expect(calls).toHaveLength(1);
    vi.useRealTimers();
  });
});
