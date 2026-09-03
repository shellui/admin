import { useShelluiHosting, isHostingAdminEnabled } from '@/hooks/useShelluiHosting';

/** hosting-service base URL from host `hosting.url` (via SDK). */
export function useHostingBaseUrl(): string | null {
  const hosting = useShelluiHosting();
  if (!isHostingAdminEnabled(hosting)) return null;
  const url = hosting?.url?.trim().replace(/\/+$/, '') || null;
  return url;
}

export type HostingAccess = {
  company_id: number;
  status: 'none' | 'pending' | 'approved' | 'denied';
  requested_at: string | null;
  requested_by_id: number | null;
  reviewed_at: string | null;
  reviewed_by_id: number | null;
  notes: string;
};

export type HostingApp = {
  id: string;
  name: string;
  slug: string;
  company_id: number;
  display_name: string;
  expires_at?: string | null;
  current_deployment_id: string | null;
  urls?: { url?: string };
  created_at: string;
  updated_at: string;
};

export type HostingDeployment = {
  id: string;
  app_id: string;
  app_version: string;
  shellui_version: string;
  status: string;
  pinned: boolean;
  storage_prefix: string;
  deployed_by_id: number | null;
  artifact_size: number;
  urls?: { url?: string };
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
};

export type HostingStatsSnapshot = {
  company_id: number | null;
  apps: number;
  deployments: number;
  deployments_by_status: Record<string, number>;
  active_deployments: number;
  access: {
    pending: number;
    approved: number;
    denied: number;
  };
  artifact_bytes: number;
};

function parseErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const o = body as Record<string, unknown>;
  if (typeof o.message === 'string') return o.message;
  if (typeof o.detail === 'string') return o.detail;
  if (typeof o.error === 'string') return o.error;
  return fallback;
}

async function hostingFetch<T>(
  hostingBaseUrl: string,
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const base = hostingBaseUrl.replace(/\/+$/, '');
  const url = `${base}/hosting/v1${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(url, { ...init, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(parseErrorMessage(body, response.statusText || 'Request failed'));
  }
  return body as T;
}

export async function fetchHostingAccess(
  hostingBaseUrl: string,
  accessToken: string,
): Promise<HostingAccess> {
  return hostingFetch(hostingBaseUrl, accessToken, '/access');
}

export async function requestHostingAccess(
  hostingBaseUrl: string,
  accessToken: string,
): Promise<HostingAccess> {
  return hostingFetch(hostingBaseUrl, accessToken, '/access/request', { method: 'POST' });
}

export async function fetchHostingApps(
  hostingBaseUrl: string,
  accessToken: string,
): Promise<HostingApp[]> {
  return hostingFetch(hostingBaseUrl, accessToken, '/apps');
}

export async function fetchHostingApp(
  hostingBaseUrl: string,
  accessToken: string,
  appName: string,
): Promise<HostingApp> {
  return hostingFetch(hostingBaseUrl, accessToken, `/apps/${encodeURIComponent(appName)}`);
}

export async function fetchHostingDeployments(
  hostingBaseUrl: string,
  accessToken: string,
  appName: string,
): Promise<HostingDeployment[]> {
  return hostingFetch(
    hostingBaseUrl,
    accessToken,
    `/apps/${encodeURIComponent(appName)}/deployments`,
  );
}

export async function rollbackHostingDeployment(
  hostingBaseUrl: string,
  accessToken: string,
  appName: string,
  deploymentId: string,
): Promise<HostingDeployment> {
  return hostingFetch(
    hostingBaseUrl,
    accessToken,
    `/apps/${encodeURIComponent(appName)}/deployments/${encodeURIComponent(deploymentId)}/rollback`,
    { method: 'POST' },
  );
}

export async function renewHostingAppExpiry(
  hostingBaseUrl: string,
  accessToken: string,
  appRef: string,
): Promise<HostingApp> {
  return hostingFetch(
    hostingBaseUrl,
    accessToken,
    `/apps/${encodeURIComponent(appRef)}/renew-expiry`,
    { method: 'POST' },
  );
}

export async function deleteHostingApp(
  hostingBaseUrl: string,
  accessToken: string,
  appRef: string,
): Promise<void> {
  const base = hostingBaseUrl.replace(/\/+$/, '');
  const url = `${base}/hosting/v1/apps/${encodeURIComponent(appRef)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (response.status === 204) return;
  const body = await response.json().catch(() => null);
  throw new Error(parseErrorMessage(body, response.statusText || 'Request failed'));
}

export async function fetchHostingStats(
  hostingBaseUrl: string,
  accessToken: string,
): Promise<HostingStatsSnapshot> {
  return hostingFetch(hostingBaseUrl, accessToken, '/stats');
}
