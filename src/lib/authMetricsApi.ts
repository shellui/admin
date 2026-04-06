import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import {
  getLoginCountsByProvider,
  getUnlabeled,
  parsePrometheusSamples,
  sumLoginCounts,
} from '@/lib/prometheusText';

export const SHELLUI_AUTH_METRIC_NAMES = {
  usersTotal: 'shellui_auth_users_total',
  usersActive: 'shellui_auth_users_active',
  usersStaff: 'shellui_auth_users_staff',
  socialAccountsTotal: 'shellui_auth_social_accounts_total',
  dailyActiveUsers: 'shellui_auth_daily_active_users',
  weeklyActiveUsers: 'shellui_auth_weekly_active_users',
  monthlyActiveUsers: 'shellui_auth_monthly_active_users',
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

function parseErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === 'string') return o.detail;
  if (typeof o.error === 'string') return o.error;
  return null;
}

/** Staff-only Prometheus text from shellui-auth `GET /auth/v1/admin/metrics`. */
export async function fetchStaffPrometheusMetrics(accessToken: string): Promise<string> {
  const base = getAuthBackendBaseUrl();
  const res = await fetch(`${base}/auth/v1/admin/metrics`, {
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

function requireFinite(samples: Map<string, number>, name: string): number {
  const v = getUnlabeled(samples, name);
  if (v === undefined || !Number.isFinite(v)) {
    throw new Error(`Missing metric ${name} in exposition`);
  }
  return v;
}

export async function fetchAuthMetricsSnapshot(accessToken: string): Promise<AuthMetricsSnapshot> {
  const rawText = await fetchStaffPrometheusMetrics(accessToken);
  const samples = parsePrometheusSamples(rawText);
  const usersTotal = requireFinite(samples, SHELLUI_AUTH_METRIC_NAMES.usersTotal);
  const usersActive = requireFinite(samples, SHELLUI_AUTH_METRIC_NAMES.usersActive);
  const usersStaff = requireFinite(samples, SHELLUI_AUTH_METRIC_NAMES.usersStaff);
  const socialAccountsTotal = requireFinite(samples, SHELLUI_AUTH_METRIC_NAMES.socialAccountsTotal);
  const dailyActiveUsers = requireFinite(samples, SHELLUI_AUTH_METRIC_NAMES.dailyActiveUsers);
  const weeklyActiveUsers = requireFinite(samples, SHELLUI_AUTH_METRIC_NAMES.weeklyActiveUsers);
  const monthlyActiveUsers = requireFinite(samples, SHELLUI_AUTH_METRIC_NAMES.monthlyActiveUsers);
  const loginsByProvider = getLoginCountsByProvider(samples);
  const loginsSinceProcessStart = sumLoginCounts(samples);

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
