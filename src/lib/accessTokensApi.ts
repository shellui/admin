import { getAuthBackendBaseUrl } from '@/lib/backendUrl';

export type AdminPersonalAccessTokenRow = {
  id: string;
  user_id: number;
  read_only: boolean;
  access_global_metrics: boolean;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type AdminPersonalAccessTokenCreateResponse = AdminPersonalAccessTokenRow & {
  access_token?: string;
};

export type AdminPersonalAccessTokenListResponse = {
  results: AdminPersonalAccessTokenRow[];
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

export async function fetchPersonalAccessTokens(
  accessToken: string,
): Promise<AdminPersonalAccessTokenListResponse> {
  const res = await authFetch('/api/v1/personal-access-tokens', accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as AdminPersonalAccessTokenListResponse;
}

export async function createPersonalAccessToken(
  accessToken: string,
  payload: { read_only?: boolean; access_global_metrics?: boolean; name?: string },
): Promise<AdminPersonalAccessTokenCreateResponse> {
  const res = await authFetch('/api/v1/personal-access-tokens', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as AdminPersonalAccessTokenCreateResponse;
}

export async function revokePersonalAccessToken(
  accessToken: string,
  keyId: string,
): Promise<AdminPersonalAccessTokenRow> {
  const res = await authFetch(`/api/v1/personal-access-tokens/${keyId}/revoke`, accessToken, {
    method: 'POST',
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as AdminPersonalAccessTokenRow;
}
