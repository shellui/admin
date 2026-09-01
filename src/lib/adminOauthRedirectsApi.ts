import { getAuthBackendBaseUrl } from '@/lib/backendUrl';

export type OAuthRedirectRow = {
  id: number;
  base_url: string;
  label: string;
  is_active: boolean;
  created_at: string | null;
};

function parseErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === 'string') return o.detail;
  if (typeof o.error === 'string') return o.error;
  const firstKey = Object.keys(o)[0];
  const v = firstKey ? o[firstKey] : null;
  if (Array.isArray(v) && typeof v[0] === 'string') return `${firstKey}: ${v[0]}`;
  if (typeof v === 'string') return v;
  return null;
}

async function authFetch(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = getAuthBackendBaseUrl();
  const url = new URL(`${base}${path}`);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url.toString(), { ...init, headers });
}

export async function fetchOAuthRedirects(accessToken: string): Promise<OAuthRedirectRow[]> {
  const res = await authFetch('/api/v1/oauth-redirects', accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  if (!Array.isArray(body)) {
    throw new Error('Unexpected oauth-redirects response.');
  }
  return body as OAuthRedirectRow[];
}

export async function createOAuthRedirect(
  accessToken: string,
  payload: { base_url: string; label?: string; is_active?: boolean },
): Promise<OAuthRedirectRow> {
  const res = await authFetch('/api/v1/oauth-redirects', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as OAuthRedirectRow;
}

export async function deleteOAuthRedirect(accessToken: string, id: number): Promise<void> {
  const res = await authFetch(`/api/v1/oauth-redirects/${id}`, accessToken, {
    method: 'DELETE',
  });
  if (res.status === 204) return;
  const body = await res.json().catch(() => null);
  throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
}
