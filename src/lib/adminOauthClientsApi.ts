import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

export type OAuthClientRow = {
  id: number;
  provider: 'github' | 'google' | 'microsoft';
  label: string;
  client_id: string;
  social_app_id?: number;
  tenant: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OAuthSocialAppRow = {
  id: number;
  provider: string;
  name: string;
  client_id: string;
  tenant?: string;
  is_linked: boolean;
  mapping_id: number | null;
  mapping_is_active: boolean;
};

export type OAuthSocialAppsCatalog = {
  providers: string[];
  social_apps: OAuthSocialAppRow[];
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

export async function fetchOAuthClients(accessToken: string): Promise<OAuthClientRow[]> {
  const res = await authFetch('/auth/v1/admin/oauth-clients', accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  if (!Array.isArray(body)) {
    throw new Error('Unexpected oauth-clients response.');
  }
  return body as OAuthClientRow[];
}

export async function createOAuthClient(
  accessToken: string,
  payload: {
    social_app_id: number;
    is_active?: boolean;
  },
): Promise<OAuthClientRow> {
  const res = await authFetch('/auth/v1/admin/oauth-clients', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as OAuthClientRow;
}

export async function updateOAuthClient(
  accessToken: string,
  id: number,
  payload: {
    social_app_id?: number;
    is_active?: boolean;
  },
): Promise<OAuthClientRow> {
  const res = await authFetch(`/auth/v1/admin/oauth-clients/${id}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as OAuthClientRow;
}

export async function deleteOAuthClient(accessToken: string, id: number): Promise<void> {
  const res = await authFetch(`/auth/v1/admin/oauth-clients/${id}`, accessToken, {
    method: 'DELETE',
  });
  if (res.status === 204) return;
  const body = await res.json().catch(() => null);
  throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
}

export async function fetchOAuthSocialApps(accessToken: string): Promise<OAuthSocialAppsCatalog> {
  const res = await authFetch('/auth/v1/admin/oauth-social-apps', accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected oauth-social-apps response.');
  }
  const obj = body as Record<string, unknown>;
  return {
    providers: Array.isArray(obj.providers) ? (obj.providers.filter((v): v is string => typeof v === 'string')) : [],
    social_apps: Array.isArray(obj.social_apps)
      ? (obj.social_apps as OAuthSocialAppRow[])
      : [],
  };
}

export async function createOAuthSocialApp(
  accessToken: string,
  payload: {
    provider: string;
    client_id: string;
    client_secret: string;
    tenant?: string;
  },
): Promise<void> {
  const res = await authFetch('/auth/v1/admin/oauth-social-apps', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
}

export async function deleteOAuthSocialApp(accessToken: string, id: number): Promise<void> {
  const res = await authFetch(`/auth/v1/admin/oauth-social-apps/${id}`, accessToken, {
    method: 'DELETE',
  });
  if (res.status === 204) return;
  const body = await res.json().catch(() => null);
  throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
}

export async function updateOAuthSocialApp(
  accessToken: string,
  id: number,
  payload: {
    client_id?: string;
    client_secret?: string;
    tenant?: string;
  },
): Promise<OAuthSocialAppRow> {
  const res = await authFetch(`/auth/v1/admin/oauth-social-apps/${id}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as OAuthSocialAppRow;
}
