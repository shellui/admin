import { bearerFetch } from './shellAccessToken';
import { AuthBackendNotConfiguredError, getAuthBackendBaseUrl } from '@/lib/backendUrl';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

export type AuthSuccessfulLogin = {
  provider: string;
  total: number;
};

export type AuthMetricsSnapshot = {
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

type IdentityStatsResponse = {
  company_id?: number;
  users_total?: number;
  users_active?: number;
  users_staff?: number;
  social_accounts_total?: number;
  daily_active_users?: number;
  weekly_active_users?: number;
  monthly_active_users?: number;
  successful_logins?: Array<{ provider?: string; total?: number }>;
};

function parseErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === 'string') return o.detail;
  if (typeof o.error === 'string') return o.error;
  return null;
}

function readInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Missing ${field} in identity stats response`);
  }
  return value;
}

export function parseAuthStatsJson(body: unknown): AuthMetricsSnapshot {
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected identity stats response.');
  }
  const data = body as IdentityStatsResponse;
  const rawLogins = Array.isArray(data.successful_logins) ? data.successful_logins : [];
  const successfulLogins = rawLogins
    .filter(
      (row): row is { provider: string; total: number } =>
        Boolean(row) &&
        typeof row.provider === 'string' &&
        row.provider.trim() !== '' &&
        typeof row.total === 'number' &&
        Number.isFinite(row.total),
    )
    .map((row) => ({ provider: row.provider.trim(), total: row.total }))
    .sort((a, b) => b.total - a.total || a.provider.localeCompare(b.provider));

  return {
    usersTotal: readInt(data.users_total, 'users_total'),
    usersActive: readInt(data.users_active, 'users_active'),
    usersStaff: readInt(data.users_staff, 'users_staff'),
    socialAccountsTotal: readInt(data.social_accounts_total, 'social_accounts_total'),
    dailyActiveUsers: readInt(data.daily_active_users, 'daily_active_users'),
    weeklyActiveUsers: readInt(data.weekly_active_users, 'weekly_active_users'),
    monthlyActiveUsers: readInt(data.monthly_active_users, 'monthly_active_users'),
    successfulLogins,
  };
}

/** Company JSON stats from identity-service `GET /api/v1/stats` (staff or company owner). */
export async function fetchAuthMetricsSnapshot(accessToken: string): Promise<AuthMetricsSnapshot> {
  const companyId = getCompanyIdFromJwt(accessToken);
  if (!companyId) {
    throw new Error('Missing company_id in access token.');
  }
  const base = getAuthBackendBaseUrl();
  if (!base) throw new AuthBackendNotConfiguredError();
  const res = await bearerFetch(
    `${base}/api/v1/stats`,
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
  return parseAuthStatsJson(body);
}
