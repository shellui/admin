import { bearerAuthorization } from './shellAccessToken';
import { AuthBackendNotConfiguredError, getAuthBackendBaseUrl } from '@/lib/backendUrl';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';
import { parsePrometheusSamples } from '@/lib/prometheusText';

export const SHELLUI_AUTH_METRIC_NAMES = {
  usersTotal: 'shellui_auth_company_users_total',
  usersActive: 'shellui_auth_company_users_active',
  usersStaff: 'shellui_auth_company_users_staff',
  socialAccountsTotal: 'shellui_auth_company_social_accounts_total',
  dailyActiveUsers: 'shellui_auth_company_daily_active_users',
  weeklyActiveUsers: 'shellui_auth_company_weekly_active_users',
  monthlyActiveUsers: 'shellui_auth_company_monthly_active_users',
  successfulLogins: 'shellui_auth_successful_logins_total',
} as const;

export type AuthSuccessfulLogin = {
  provider: string;
  total: number;
};

export type AuthMetricsSnapshot = {
  rawText: string;
  usersTotal: number;
  usersActive: number;
  usersStaff: number;
  socialAccountsTotal: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  /** Process-local counter. A restart sets these back to zero. */
  successfulLogins: AuthSuccessfulLogin[];
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

function parsePrometheusLabels(body: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g;
  for (const match of body.matchAll(re)) {
    labels[match[1]] = match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return labels;
}

/**
 * Successful sign-ins for this company only.
 * The counter lives on the company scrape and resets when the process restarts.
 * Series for any other company are ignored.
 */
export function readSuccessfulLogins(
  samples: Map<string, number>,
  companyId: number,
): AuthSuccessfulLogin[] {
  const name = SHELLUI_AUTH_METRIC_NAMES.successfulLogins;
  const prefix = `${name}{`;
  const byProvider = new Map<string, number>();
  for (const [lhs, value] of samples) {
    if (!lhs.startsWith(prefix) || !lhs.endsWith('}')) continue;
    const labels = parsePrometheusLabels(lhs.slice(prefix.length, -1));
    if (labels.company_id !== String(companyId)) continue;
    const provider = labels.provider?.trim();
    if (!provider || !Number.isFinite(value)) continue;
    byProvider.set(provider, (byProvider.get(provider) ?? 0) + value);
  }
  return [...byProvider.entries()]
    .map(([provider, total]) => ({ provider, total }))
    .sort((a, b) => b.total - a.total || a.provider.localeCompare(b.provider));
}

export function parseAuthMetricsText(rawText: string, companyId: number): AuthMetricsSnapshot {
  const samples = parsePrometheusSamples(rawText);
  return {
    rawText,
    usersTotal: readCompanySeries(samples, SHELLUI_AUTH_METRIC_NAMES.usersTotal, companyId),
    usersActive: readCompanySeries(samples, SHELLUI_AUTH_METRIC_NAMES.usersActive, companyId),
    usersStaff: readCompanySeries(samples, SHELLUI_AUTH_METRIC_NAMES.usersStaff, companyId),
    socialAccountsTotal: readCompanySeries(
      samples,
      SHELLUI_AUTH_METRIC_NAMES.socialAccountsTotal,
      companyId,
    ),
    dailyActiveUsers: readCompanySeries(
      samples,
      SHELLUI_AUTH_METRIC_NAMES.dailyActiveUsers,
      companyId,
    ),
    weeklyActiveUsers: readCompanySeries(
      samples,
      SHELLUI_AUTH_METRIC_NAMES.weeklyActiveUsers,
      companyId,
    ),
    monthlyActiveUsers: readCompanySeries(
      samples,
      SHELLUI_AUTH_METRIC_NAMES.monthlyActiveUsers,
      companyId,
    ),
    successfulLogins: readSuccessfulLogins(samples, companyId),
  };
}

function parseErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === 'string') return o.detail;
  if (typeof o.error === 'string') return o.error;
  return null;
}

/** Full URL for `GET /api/v1/metrics` (Bearer token required). Null when identity URL is unset. */
export function buildStaffPrometheusMetricsUrl(): string | null {
  const base = getAuthBackendBaseUrl();
  return base ? `${base}/api/v1/metrics` : null;
}

/** Prometheus text from shellui-auth `GET /api/v1/metrics` (staff or company owner). */
export async function fetchStaffPrometheusMetrics(accessToken: string): Promise<string> {
  const url = buildStaffPrometheusMetricsUrl();
  if (!url) throw new AuthBackendNotConfiguredError();
  const res = await fetch(url, {
    headers: {
      Accept: 'text/plain',
      Authorization: bearerAuthorization(accessToken),
    },
  });
  const ct = res.headers.get('Content-Type') || '';
  if (!res.ok) {
    let msg: string | null = null;
    if (ct.includes('application/json')) {
      const body = await res.json().catch(() => null);
      msg = parseErrorMessage(body);
    } else {
      const text = await res.text().catch(() => '');
      msg = text.trim() || null;
    }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.text();
}

export async function fetchGlobalStaffPrometheusMetrics(accessToken: string): Promise<string> {
  const base = getAuthBackendBaseUrl();
  if (!base) throw new AuthBackendNotConfiguredError();
  const res = await fetch(`${base}/api/v1/metrics/all`, {
    headers: {
      Accept: 'text/plain',
      Authorization: bearerAuthorization(accessToken),
    },
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.text();
}

export async function fetchAuthMetricsSnapshot(accessToken: string): Promise<AuthMetricsSnapshot> {
  const companyId = getCompanyIdFromJwt(accessToken);
  if (!companyId) {
    throw new Error('Missing company_id in access token.');
  }
  const rawText = await fetchStaffPrometheusMetrics(accessToken);
  return parseAuthMetricsText(rawText, companyId);
}
