import { afterEach, describe, expect, it } from 'vitest';
import {
  bearerAuthorization,
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
    expect(bearerAuthorization(old)).toBe(`Bearer ${old}`);

    setLatestShellAccessToken(renewed);
    expect(bearerAuthorization(old)).toBe(`Bearer ${renewed}`);
    expect(freshShellAccessToken(stranger)).toBe(stranger);

    setLatestShellAccessToken(null);
    expect(freshShellAccessToken(old)).toBe(old);
  });
});
