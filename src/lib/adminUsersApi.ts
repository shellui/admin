import { getAuthBackendBaseUrl } from '@/lib/backendUrl';

export type AdminUserRow = {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_active: boolean;
  user_metadata: Record<string, unknown>;
};

export type AdminUserListResponse = {
  count: number;
  page: number;
  page_size: number;
  results: AdminUserRow[];
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

/** `accessToken` is `Settings.accessToken` from the shell (session JWT). */
async function authFetch(path: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  const base = getAuthBackendBaseUrl();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(`${base}${path}`, { ...init, headers });
}

export async function fetchAdminUsers(
  accessToken: string,
  params: { q?: string; page?: number; pageSize?: number },
): Promise<AdminUserListResponse> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set('q', params.q.trim());
  if (params.page != null) sp.set('page', String(params.page));
  if (params.pageSize != null) sp.set('page_size', String(params.pageSize));
  const q = sp.toString();
  const path = `/auth/v1/admin/users${q ? `?${q}` : ''}`;
  const res = await authFetch(path, accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as AdminUserListResponse;
}

export async function fetchAdminUser(accessToken: string, userId: number): Promise<AdminUserRow> {
  const res = await authFetch(`/auth/v1/admin/users/${userId}`, accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as AdminUserRow;
}

export type AdminUserUpdatePayload = {
  first_name?: string;
  last_name?: string;
  is_staff?: boolean;
  is_active?: boolean;
  data?: Record<string, unknown>;
};

export async function updateAdminUser(
  accessToken: string,
  userId: number,
  payload: AdminUserUpdatePayload,
): Promise<AdminUserRow> {
  const res = await authFetch(`/auth/v1/admin/users/${userId}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as AdminUserRow;
}
