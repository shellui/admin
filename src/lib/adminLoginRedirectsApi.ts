import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

export type LoginRedirectRow = {
  id: number;
  base_url: string;
  label: string;
  is_active: boolean;
  created_at: string;
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

async function authFetch(path: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  const base = getAuthBackendBaseUrl();
  const companyId = getCompanyIdFromJwt(accessToken);
  if (!companyId) {
    throw new Error('Missing company_id in access token.');
  }
  const url = new URL(`${base}${path}`);
  if (!url.searchParams.get('company_id')) {
    url.searchParams.set('company_id', String(companyId));
  }
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url.toString(), { ...init, headers });
}

export async function fetchLoginRedirects(accessToken: string): Promise<LoginRedirectRow[]> {
  const res = await authFetch('/auth/v1/admin/login-redirects', accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  if (!Array.isArray(body)) {
    throw new Error('Unexpected login-redirects response.');
  }
  return body as LoginRedirectRow[];
}

export async function createLoginRedirect(
  accessToken: string,
  payload: { base_url: string; label?: string },
): Promise<LoginRedirectRow> {
  const res = await authFetch('/auth/v1/admin/login-redirects', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as LoginRedirectRow;
}

export async function updateLoginRedirect(
  accessToken: string,
  id: number,
  payload: { base_url?: string; label?: string; is_active?: boolean },
): Promise<LoginRedirectRow> {
  const res = await authFetch(`/auth/v1/admin/login-redirects/${id}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as LoginRedirectRow;
}

export async function deleteLoginRedirect(accessToken: string, id: number): Promise<void> {
  const res = await authFetch(`/auth/v1/admin/login-redirects/${id}`, accessToken, {
    method: 'DELETE',
  });
  if (res.status === 204) return;
  const body = await res.json().catch(() => null);
  throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
}
