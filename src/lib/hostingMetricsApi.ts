import { bearerFetch } from './shellAccessToken';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';
import { formatBytes } from '@/lib/storageMetricsApi';

export { formatBytes };

export type HostingMetricsSnapshot = {
  appsTotal: number;
  appsExpired: number;
  deploymentsTotal: number;
  activeDeployments: number;
  artifactBytes: number;
  deployments24h: number;
  deployments7d: number;
  deployments30d: number;
  accessPending: number;
  accessApproved: number;
  accessDenied: number;
};

type HostingStatsJson = {
  apps?: number;
  apps_expired?: number;
  deployments?: number;
  active_deployments?: number;
  artifact_bytes?: number;
  deployments_24h?: number;
  deployments_7d?: number;
  deployments_30d?: number;
  access?: {
    pending?: number;
    approved?: number;
    denied?: number;
  };
};

function parseErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === 'string') return o.detail;
  if (typeof o.error === 'string') return o.error;
  if (typeof o.message === 'string') return o.message;
  return null;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function parseHostingStatsSnapshot(body: unknown): HostingMetricsSnapshot {
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected hosting stats response.');
  }
  const data = body as HostingStatsJson;
  return {
    appsTotal: num(data.apps),
    appsExpired: num(data.apps_expired),
    deploymentsTotal: num(data.deployments),
    activeDeployments: num(data.active_deployments),
    artifactBytes: num(data.artifact_bytes),
    deployments24h: num(data.deployments_24h),
    deployments7d: num(data.deployments_7d),
    deployments30d: num(data.deployments_30d),
    accessPending: num(data.access?.pending),
    accessApproved: num(data.access?.approved),
    accessDenied: num(data.access?.denied),
  };
}

/** Hosting JSON stats from hosting-service `GET /hosting/v1/stats`. */
export async function fetchHostingMetricsSnapshot(
  hostingBaseUrl: string,
  accessToken: string,
): Promise<HostingMetricsSnapshot> {
  const companyId = getCompanyIdFromJwt(accessToken);
  if (!companyId) {
    throw new Error('Missing company_id in access token.');
  }
  const res = await bearerFetch(
    `${hostingBaseUrl.replace(/\/+$/, '')}/hosting/v1/stats`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
    accessToken,
  );
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return parseHostingStatsSnapshot(body);
}
