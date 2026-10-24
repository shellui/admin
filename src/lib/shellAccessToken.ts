import { sendMessageToParent } from '@shellui/sdk';
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
  const changed = token !== latest;
  latest = token;
  if (changed) for (const wake of [...waiters]) wake();
}

/** Token to send for `token`: the newest renewal of the same session, else `token` itself. */
export function freshShellAccessToken(token: string): string {
  if (latest && latest !== token && isSameShellSession(token, latest)) return latest;
  return token;
}

export class SessionExpiredError extends Error {
  readonly status = 401;
  constructor() {
    super('Your session expired. Sign in again to continue.');
    this.name = 'SessionExpiredError';
  }
}

let waiters: Array<() => void> = [];
let pending: Promise<void> | null = null;

/** Ask the shell for settings and wait (up to 5s) for a newer token. One request at a time. */
export function requestFreshToken(timeoutMs = 5000): Promise<void> {
  pending ??= new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      waiters = waiters.filter((w) => w !== done);
      pending = null;
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    waiters.push(done);
    sendMessageToParent({ type: 'SHELLUI_SETTINGS_REQUESTED', payload: {} });
  });
  return pending;
}

/** `fetch` with the newest bearer token. On 401 it asks the shell for a fresh token and retries once. */
export async function bearerFetch(
  url: string | URL,
  init: RequestInit,
  token: string,
): Promise<Response> {
  const send = (bearer: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${bearer}`);
    return fetch(url, { ...init, headers });
  };
  const first = freshShellAccessToken(token);
  const res = await send(first);
  if (res.status !== 401) return res;
  await requestFreshToken();
  const next = freshShellAccessToken(token);
  if (next === first) throw new SessionExpiredError();
  const retry = await send(next);
  if (retry.status === 401) throw new SessionExpiredError();
  return retry;
}
