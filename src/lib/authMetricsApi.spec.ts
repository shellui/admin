import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAuthMetricsSnapshot, parseAuthStatsJson } from '@/lib/authMetricsApi';

const COMPANY = 10;

function accessToken(companyId: number): string {
  const payload = btoa(JSON.stringify({ company_id: companyId }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `header.${payload}.sig`;
}

describe('parseAuthStatsJson', () => {
  it('reads company counts and successful sign-ins', () => {
    const snapshot = parseAuthStatsJson({
      company_id: COMPANY,
      users_total: 8,
      users_active: 6,
      users_staff: 1,
      social_accounts_total: 3,
      daily_active_users: 2,
      weekly_active_users: 4,
      monthly_active_users: 5,
      successful_logins: [
        { provider: 'magic_link', total: 1 },
        { provider: 'google', total: 6 },
      ],
    });
    expect(snapshot.usersTotal).toBe(8);
    expect(snapshot.usersActive).toBe(6);
    expect(snapshot.usersStaff).toBe(1);
    expect(snapshot.socialAccountsTotal).toBe(3);
    expect(snapshot.dailyActiveUsers).toBe(2);
    expect(snapshot.weeklyActiveUsers).toBe(4);
    expect(snapshot.monthlyActiveUsers).toBe(5);
    expect(snapshot.successfulLogins).toEqual([
      { provider: 'google', total: 6 },
      { provider: 'magic_link', total: 1 },
    ]);
  });

  it('throws when a required count is missing', () => {
    expect(() => parseAuthStatsJson({})).toThrow(/Missing users_total/);
  });
});

describe('fetchAuthMetricsSnapshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads GET /api/v1/stats with a Bearer token', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe('http://localhost:8000/api/v1/stats');
      expect(new Headers(init?.headers).get('Accept')).toBe('application/json');
      return new Response(
        JSON.stringify({
          company_id: COMPANY,
          users_total: 8,
          users_active: 6,
          users_staff: 1,
          social_accounts_total: 3,
          daily_active_users: 2,
          weekly_active_users: 4,
          monthly_active_users: 5,
          successful_logins: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const token = accessToken(COMPANY);
    const snapshot = await fetchAuthMetricsSnapshot(token);
    expect(snapshot.usersTotal).toBe(8);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('surfaces a forbidden stats response as an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    await expect(fetchAuthMetricsSnapshot(accessToken(COMPANY))).rejects.toThrow(/Forbidden/);
  });
});
