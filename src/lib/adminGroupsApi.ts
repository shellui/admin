import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import {
  parseAdminGroupRow,
  parseAdminGroupsList,
  parseGroupsApiErrorMessage,
  type AdminGroupRow,
} from '@/lib/adminGroupsApiParsers';

export type { AdminGroupRow, AdminGroupSource } from '@/lib/adminGroupsApiParsers';

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

export async function fetchAdminGroups(accessToken: string): Promise<AdminGroupRow[]> {
  const res = await authFetch('/api/v1/groups', accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseGroupsApiErrorMessage(body) || `Request failed (${res.status})`);
  }
  return parseAdminGroupsList(body);
}

export async function createAdminGroup(
  accessToken: string,
  displayName: string,
): Promise<AdminGroupRow> {
  const res = await authFetch('/api/v1/groups', accessToken, {
    method: 'POST',
    body: JSON.stringify({ display_name: displayName }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseGroupsApiErrorMessage(body) || `Request failed (${res.status})`);
  }
  return parseAdminGroupRow(body);
}

export async function renameAdminGroup(
  accessToken: string,
  groupId: number,
  displayName: string,
): Promise<AdminGroupRow> {
  const res = await authFetch(`/api/v1/groups/${groupId}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify({ display_name: displayName }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseGroupsApiErrorMessage(body) || `Request failed (${res.status})`);
  }
  return parseAdminGroupRow(body);
}

export async function deleteAdminGroup(accessToken: string, groupId: number): Promise<void> {
  const res = await authFetch(`/api/v1/groups/${groupId}`, accessToken, {
    method: 'DELETE',
  });
  if (res.status === 204) return;
  const body = await res.json().catch(() => null);
  throw new Error(parseGroupsApiErrorMessage(body) || `Request failed (${res.status})`);
}
