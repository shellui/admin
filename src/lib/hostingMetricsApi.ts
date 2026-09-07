import { parsePrometheusSamples } from '@/lib/prometheusText';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';
import { formatBytes } from '@/lib/storageMetricsApi';

export { formatBytes };

export const SHELLUI_HOSTING_METRIC_NAMES = {
  appsTotal: 'shellui_hosting_apps_total',
  appsExpired: 'shellui_hosting_apps_expired',
  deploymentsTotal: 'shellui_hosting_deployments_total',
  activeDeployments: 'shellui_hosting_active_deployments',
  artifactBytes: 'shellui_hosting_artifact_bytes',
  deployments24h: 'shellui_hosting_deployments_24h',
  deployments7d: 'shellui_hosting_deployments_7d',
  deployments30d: 'shellui_hosting_deployments_30d',
  accessPending: 'shellui_hosting_access_pending',
  accessApproved: 'shellui_hosting_access_approved',
  accessDenied: 'shellui_hosting_access_denied',
} as const;

export type HostingMetricsSnapshot = {
  rawText: string;
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

function readCompanySeries(
  samples: Map<string, number>,
  metricName: string,
  companyId: number,
): number {
  const key = `${metricName}{company_id="${companyId}"}`;
  const v = samples.get(key);
  if (v === undefined || !Number.isFinite(v)) {
    throw new Error(`Missing metric ${key} in exposition`);
  }
  return v;
}

function parseErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === 'string') return o.detail;
  if (typeof o.error === 'string') return o.error;
  if (typeof o.message === 'string') return o.message;
  return null;
}

export function buildHostingPrometheusMetricsUrl(hostingBaseUrl: string): string {
  return `${hostingBaseUrl.replace(/\/+$/, '')}/hosting/v1/metrics`;
}

/** Prometheus text from hosting-service `GET /hosting/v1/metrics` (staff or company owner). */
export async function fetchHostingPrometheusMetrics(
  hostingBaseUrl: string,
  accessToken: string,
): Promise<string> {
  const res = await fetch(buildHostingPrometheusMetricsUrl(hostingBaseUrl), {
    headers: {
      Accept: 'text/plain',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const ct = res.headers.get('Content-Type') || '';
  if (!res.ok) {
    let msg: string | null = null;
    if (ct.includes('application/json') || ct.includes('text/plain')) {
      if (ct.includes('application/json')) {
        const body = await res.json().catch(() => null);
        msg = parseErrorMessage(body);
      } else {
        const text = await res.text().catch(() => '');
        try {
          msg = parseErrorMessage(JSON.parse(text));
        } catch {
          msg = text.trim() || null;
        }
      }
    } else {
      const text = await res.text().catch(() => '');
      msg = text.trim() || null;
    }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.text();
}

export async function fetchHostingMetricsSnapshot(
  hostingBaseUrl: string,
  accessToken: string,
): Promise<HostingMetricsSnapshot> {
  const companyId = getCompanyIdFromJwt(accessToken);
  if (!companyId) {
    throw new Error('Missing company_id in access token.');
  }
  const rawText = await fetchHostingPrometheusMetrics(hostingBaseUrl, accessToken);
  const samples = parsePrometheusSamples(rawText);
  return {
    rawText,
    appsTotal: readCompanySeries(samples, SHELLUI_HOSTING_METRIC_NAMES.appsTotal, companyId),
    appsExpired: readCompanySeries(samples, SHELLUI_HOSTING_METRIC_NAMES.appsExpired, companyId),
    deploymentsTotal: readCompanySeries(
      samples,
      SHELLUI_HOSTING_METRIC_NAMES.deploymentsTotal,
      companyId,
    ),
    activeDeployments: readCompanySeries(
      samples,
      SHELLUI_HOSTING_METRIC_NAMES.activeDeployments,
      companyId,
    ),
    artifactBytes: readCompanySeries(
      samples,
      SHELLUI_HOSTING_METRIC_NAMES.artifactBytes,
      companyId,
    ),
    deployments24h: readCompanySeries(
      samples,
      SHELLUI_HOSTING_METRIC_NAMES.deployments24h,
      companyId,
    ),
    deployments7d: readCompanySeries(
      samples,
      SHELLUI_HOSTING_METRIC_NAMES.deployments7d,
      companyId,
    ),
    deployments30d: readCompanySeries(
      samples,
      SHELLUI_HOSTING_METRIC_NAMES.deployments30d,
      companyId,
    ),
    accessPending: readCompanySeries(
      samples,
      SHELLUI_HOSTING_METRIC_NAMES.accessPending,
      companyId,
    ),
    accessApproved: readCompanySeries(
      samples,
      SHELLUI_HOSTING_METRIC_NAMES.accessApproved,
      companyId,
    ),
    accessDenied: readCompanySeries(samples, SHELLUI_HOSTING_METRIC_NAMES.accessDenied, companyId),
  };
}
