import { getAuthBackendBaseUrl } from '@/lib/backendUrl';

export type AdminUserGroupRef = {
  id: number;
  name: string;
};

/** Persisted Shellui preferences (also nested under `user_metadata.shelluiPreferences` for admin payloads). */
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
  /** Member of `Company.owners` for the requested company (JWT tenant). */
  is_company_owner: boolean;
  /** Per-company membership access (`CompanyMembership.is_enabled`), not Django User.is_active. */
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
  /** Enable/disable access for the current company only. */
  is_active?: boolean;
  group_ids?: number[];
  data?: Record<string, unknown>;
};

/**
 * identity-service 0.7.0 rejects `is_staff` and `is_superuser` on this route
 * (`400 admin_only_field`). Those flags are Django admin only.
 */
function withoutStaffFlags(payload: AdminUserUpdatePayload): AdminUserUpdatePayload {
  const body = { ...(payload as Record<string, unknown>) };
  delete body.is_staff;
  delete body.is_superuser;
  return body as AdminUserUpdatePayload;
}

export async function updateAdminUser(
  accessToken: string,
  userId: number,
  payload: AdminUserUpdatePayload,
): Promise<AdminUserRow> {
  const res = await authFetch(`/api/v1/users/${userId}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(withoutStaffFlags(payload)),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as AdminUserRow;
}

export type InviteLanguage = 'en' | 'fr';

export type InviteUserPayload = {
  email: string;
  language: InviteLanguage;
  /** Shell URL linked from the email; must be on the company OAuth redirect allowlist. */
  app_url?: string;
};

export type AdminInvitation = {
  id: number;
  email: string;
  language: InviteLanguage;
  /** `revoked` rows are listed while they still block sign-in for that email. */
  status: 'pending' | 'revoked';
  invited_by: { id: number; email: string | null; name: string } | null;
  created_at: string;
  revoked_at: string | null;
};

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

async function adminApiError(res: Response): Promise<AdminApiError> {
  const body = await res.json().catch(() => null);
  const code =
    body && typeof (body as Record<string, unknown>).error_code === 'string'
      ? ((body as Record<string, unknown>).error_code as string)
      : null;
  return new AdminApiError(parseErrorMessage(body) || `Request failed (${res.status})`, code);
}

/**
 * Stores a pending invitation and sends the invitation email (or the `identity.user.invited`
 * webhook). No account is created: the invitee gets access on their first sign-in.
 */
export async function inviteAdminUser(
  accessToken: string,
  payload: InviteUserPayload,
): Promise<AdminInvitation> {
  const res = await authFetch('/api/v1/invitations', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await adminApiError(res);
  const body = (await res.json()) as { invitation: AdminInvitation };
  return body.invitation;
}

/** Pending invitations, plus revoked ones that still block sign-in. */
export async function fetchAdminInvitations(accessToken: string): Promise<AdminInvitation[]> {
  const res = await authFetch('/api/v1/invitations', accessToken);
  if (!res.ok) throw await adminApiError(res);
  const body = (await res.json()) as { results: AdminInvitation[] };
  return body.results;
}

/** Revokes a pending invitation; sign-in with that email is refused until a new invitation. */
export async function revokeAdminInvitation(
  accessToken: string,
  invitationId: number,
): Promise<AdminInvitation> {
  const res = await authFetch(`/api/v1/invitations/${invitationId}/revoke`, accessToken, {
    method: 'POST',
  });
  if (!res.ok) throw await adminApiError(res);
  const body = (await res.json()) as { invitation: AdminInvitation };
  return body.invitation;
}

/** Deletes a revoked invitation for good, which also lifts the sign-in block for that email. */
export async function deleteAdminInvitation(
  accessToken: string,
  invitationId: number,
): Promise<void> {
  const res = await authFetch(`/api/v1/invitations/${invitationId}`, accessToken, {
    method: 'DELETE',
  });
  if (!res.ok) throw await adminApiError(res);
}

/**
 * Removes the user from the current company. The server deletes the account itself only when
 * this was their last company.
 */
export async function deleteAdminUser(accessToken: string, userId: number): Promise<void> {
  const res = await authFetch(`/api/v1/users/${userId}`, accessToken, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
}
