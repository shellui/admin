import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';
import {
  getLoginCountsByProvider,
  parsePrometheusSamples,
  sumLoginCounts,
} from '@/lib/prometheusText';

export const SHELLUI_AUTH_METRIC_NAMES = {
  usersTotal: 'shellui_auth_company_users_total',
  usersActive: 'shellui_auth_company_users_active',
  usersStaff: 'shellui_auth_company_users_staff',
  socialAccountsTotal: 'shellui_auth_company_social_accounts_total',
  dailyActiveUsers: 'shellui_auth_company_daily_active_users',
  weeklyActiveUsers: 'shellui_auth_company_weekly_active_users',
  monthlyActiveUsers: 'shellui_auth_company_monthly_active_users',
} as const;

export type AuthMetricsSnapshot = {
  rawText: string;
  usersTotal: number;
  usersActive: number;
  usersStaff: number;
  socialAccountsTotal: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  loginsSinceProcessStart: number;
  loginsByProvider: { provider: string; count: number }[];
};

function readCompanySeries(samples: Map<string, number>, metricName: string, companyId: number): number {
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
  return null;
}

/** Prometheus text from shellui-auth `GET /auth/v1/admin/metrics` (staff or company owner). */
export async function fetchStaffPrometheusMetrics(accessToken: string): Promise<string> {
  const base = getAuthBackendBaseUrl();
  const companyId = getCompanyIdFromJwt(accessToken);
  if (!companyId) {
    throw new Error('Missing company_id in access token.');
  }
  const res = await fetch(`${base}/auth/v1/admin/metrics?company_id=${companyId}`, {
    headers: {
      Accept: 'text/plain',
      Authorization: `Bearer ${accessToken}`,
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
  const res = await fetch(`${base}/auth/v1/admin/metrics/all`, {
    headers: {
      Accept: 'text/plain',
      Authorization: `Bearer ${accessToken}`,
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
  const samples = parsePrometheusSamples(rawText);
  const usersTotal = readCompanySeries(samples, SHELLUI_AUTH_METRIC_NAMES.usersTotal, companyId);
  const usersActive = readCompanySeries(samples, SHELLUI_AUTH_METRIC_NAMES.usersActive, companyId);
  const usersStaff = readCompanySeries(samples, SHELLUI_AUTH_METRIC_NAMES.usersStaff, companyId);
  const socialAccountsTotal = readCompanySeries(samples, SHELLUI_AUTH_METRIC_NAMES.socialAccountsTotal, companyId);
  const dailyActiveUsers = readCompanySeries(samples, SHELLUI_AUTH_METRIC_NAMES.dailyActiveUsers, companyId);
  const weeklyActiveUsers = readCompanySeries(samples, SHELLUI_AUTH_METRIC_NAMES.weeklyActiveUsers, companyId);
  const monthlyActiveUsers = readCompanySeries(samples, SHELLUI_AUTH_METRIC_NAMES.monthlyActiveUsers, companyId);
  const loginsByProvider = getLoginCountsByProvider(samples, companyId);
  const loginsSinceProcessStart = sumLoginCounts(samples, companyId);

  return {
    rawText,
    usersTotal,
    usersActive,
    usersStaff,
    socialAccountsTotal,
    dailyActiveUsers,
    weeklyActiveUsers,
    monthlyActiveUsers,
    loginsSinceProcessStart,
    loginsByProvider,
  };
}
