/**
 * Latest shell access token for this frame, kept outside React state.
 *
 * The shell renews the token every few minutes. Pages key their data loads on the token
 * they get from `useShelluiAccessToken`, so a new string on every renewal used to reload
 * every section and remount its forms (and password managers re-scanned them each time).
 * The hook now only changes its value when the signed-in identity changes, and requests
 * read the newest token here when they build the `Authorization` header.
 */

/** Claims that change on every renewal. Everything else identifies the session. */
const VOLATILE_CLAIMS = new Set(['exp', 'iat', 'nbf', 'jti']);

let latest: string | null = null;

function decodePayload(token: string): Record<string, unknown> | null {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (b64.length % 4)) % 4;
    const parsed = JSON.parse(atob(`${b64}${'='.repeat(padLen)}`)) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Stable key for who the token is for. Null for a missing or opaque token. */
export function shellAccessTokenIdentity(token: string | null): string | null {
  if (!token) return null;
  const payload = decodePayload(token);
  if (!payload) return null;
  const stable = Object.keys(payload)
    .filter((key) => !VOLATILE_CLAIMS.has(key))
    .sort()
    .map((key) => [key, payload[key]]);
  return JSON.stringify(stable);
}

/** True when `next` is a renewal of `prev` for the same user, company and roles. */
export function isSameShellSession(prev: string | null, next: string | null): boolean {
  if (!prev || !next) return false;
  if (prev === next) return true;
  const a = shellAccessTokenIdentity(prev);
  return a !== null && a === shellAccessTokenIdentity(next);
}

export function setLatestShellAccessToken(token: string | null): void {
  latest = token;
}

/** Token to send for `token`: the newest renewal of the same session, else `token` itself. */
export function freshShellAccessToken(token: string): string {
  if (latest && latest !== token && isSameShellSession(token, latest)) return latest;
  return token;
}

/** `Authorization` header value for `token`, using its newest renewal. */
export function bearerAuthorization(token: string): string {
  return `Bearer ${freshShellAccessToken(token)}`;
}
