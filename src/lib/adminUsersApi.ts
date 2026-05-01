import { getAuthBackendBaseUrl } from '@/lib/backendUrl';

export type AdminUserGroupRef = {
  id: number;
  name: string;
};

/** Persisted ShellUI preferences (also nested under `user_metadata.shelluiPreferences` for admin payloads). */
export type ShellUIPreferencesPayload = {
  themeName: string | null;
  language: string | null;
  region: string | null;
  colorScheme: string | null;
};

export type AdminUserRow = {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  /** Member of `Company.owners` for the requested `company_id`. */
  is_company_owner: boolean;
  is_active: boolean;
  groups: AdminUserGroupRef[];
  /** Includes `avatar_url`, `shelluiPreferences`, `last_seen_at`, `last_seen_client_timezone`, `groups` (names), etc. */
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
  const url = new URL(`${base}${path}`);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url.toString(), { ...init, headers });
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
  const path = `/api/v1/users${q ? `?${q}` : ''}`;
  const res = await authFetch(path, accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as AdminUserListResponse;
}

export async function fetchAdminUser(accessToken: string, userId: number): Promise<AdminUserRow> {
  const res = await authFetch(`/api/v1/users/${userId}`, accessToken);
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
  group_ids?: number[];
  data?: Record<string, unknown>;
};

export async function updateAdminUser(
  accessToken: string,
  userId: number,
  payload: AdminUserUpdatePayload,
): Promise<AdminUserRow> {
  const res = await authFetch(`/api/v1/users/${userId}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as AdminUserRow;
}

export type AdminLoginEventRow = {
  id: number;
  company_id: number | null;
  created_at: string;
  user_id: number | null;
  user_email: string | null;
  outcome: string;
  provider: string;
  failure_reason: string;
  is_staff_at_event: boolean;
  ip_hash: string;
  user_agent: string;
  client_timezone: string;
  client_device_id_hash: string;
  client_country: string;
  client_city: string;
};

export type AdminLoginEventListResponse = {
  count: number;
  page: number;
  page_size: number;
  results: AdminLoginEventRow[];
};

export type AdminLoginEventListParams = {
  user_id?: number;
  page?: number;
  pageSize?: number;
  outcome?: 'success' | 'failure';
  provider?: string;
  is_staff_at_event?: boolean;
  created_after?: string;
  created_before?: string;
  client_country?: string;
  client_city?: string;
  client_timezone?: string;
  /** Matches `UserPreference.language` for the event user (en / fr); excludes rows without a user. */
  language?: string;
};

/** Paginated OAuth login audit rows (`LoginEvent`). */
export async function fetchAdminLoginEvents(
  accessToken: string,
  params: AdminLoginEventListParams = {},
): Promise<AdminLoginEventListResponse> {
  const sp = new URLSearchParams();
  if (params.user_id != null) sp.set('user_id', String(params.user_id));
  if (params.page != null) sp.set('page', String(params.page));
  if (params.pageSize != null) sp.set('page_size', String(params.pageSize));
  if (params.outcome) sp.set('outcome', params.outcome);
  if (params.provider?.trim()) sp.set('provider', params.provider.trim().toLowerCase());
  if (params.is_staff_at_event === true) sp.set('is_staff_at_event', 'true');
  if (params.is_staff_at_event === false) sp.set('is_staff_at_event', 'false');
  if (params.created_after?.trim()) sp.set('created_after', params.created_after.trim());
  if (params.created_before?.trim()) sp.set('created_before', params.created_before.trim());
  if (params.client_country?.trim()) sp.set('client_country', params.client_country.trim());
  if (params.client_city?.trim()) sp.set('client_city', params.client_city.trim());
  if (params.client_timezone?.trim()) sp.set('client_timezone', params.client_timezone.trim());
  if (params.language?.trim()) sp.set('language', params.language.trim().toLowerCase());
  const q = sp.toString();
  const path = `/api/v1/login-events${q ? `?${q}` : ''}`;
  const res = await authFetch(path, accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as AdminLoginEventListResponse;
}

export async function fetchAdminLoginEvent(accessToken: string, eventId: number): Promise<AdminLoginEventRow> {
  const res = await authFetch(`/api/v1/login-events/${eventId}`, accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as AdminLoginEventRow;
}
