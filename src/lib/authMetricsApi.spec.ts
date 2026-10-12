import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAuthMetricsSnapshot,
  fetchStaffPrometheusMetrics,
  parseAuthMetricsText,
  SHELLUI_AUTH_METRIC_NAMES,
} from '@/lib/authMetricsApi';

const COMPANY = 10;

function gauge(name: string, companyId: number, value: number): string {
  return `${name}{company_id="${companyId}"} ${value}`;
}

function companyExposition(logins = ''): string {
  return [
    gauge(SHELLUI_AUTH_METRIC_NAMES.usersTotal, COMPANY, 8),
    gauge(SHELLUI_AUTH_METRIC_NAMES.usersActive, COMPANY, 6),
    gauge(SHELLUI_AUTH_METRIC_NAMES.usersStaff, COMPANY, 1),
    gauge(SHELLUI_AUTH_METRIC_NAMES.socialAccountsTotal, COMPANY, 3),
    gauge(SHELLUI_AUTH_METRIC_NAMES.dailyActiveUsers, COMPANY, 2),
    gauge(SHELLUI_AUTH_METRIC_NAMES.weeklyActiveUsers, COMPANY, 4),
    gauge(SHELLUI_AUTH_METRIC_NAMES.monthlyActiveUsers, COMPANY, 5),
    logins,
  ]
    .filter(Boolean)
    .join('\n');
}

function accessToken(companyId: number): string {
  const payload = btoa(JSON.stringify({ company_id: companyId }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `header.${payload}.sig`;
}

describe('parseAuthMetricsText', () => {
  it('reads company gauges and successful sign-ins for that company only', () => {
    const text = companyExposition(
      [
        `${SHELLUI_AUTH_METRIC_NAMES.successfulLogins}{company_id="10",provider="google"} 4`,
        `${SHELLUI_AUTH_METRIC_NAMES.successfulLogins}{provider="google",company_id="10"} 2`,
        `${SHELLUI_AUTH_METRIC_NAMES.successfulLogins}{company_id="10",provider="magic_link"} 1`,
        `${SHELLUI_AUTH_METRIC_NAMES.successfulLogins}{company_id="99",provider="google"} 50`,
      ].join('\n'),
    );
    const snapshot = parseAuthMetricsText(text, COMPANY);
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

  it('treats a missing login counter as no sign-ins, not an error', () => {
    expect(parseAuthMetricsText(companyExposition(), COMPANY).successfulLogins).toEqual([]);
  });

  it('throws when a required company gauge is missing', () => {
    expect(() => parseAuthMetricsText('# empty\n', COMPANY)).toThrow(/Missing metric/);
  });
});

describe('fetchAuthMetricsSnapshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the company endpoint and never the global one', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe('http://localhost:8000/api/v1/metrics');
      expect(String(url)).not.toContain('/metrics/all');
      expect(new Headers(init?.headers).get('Authorization')).toMatch(/^Bearer /);
      return new Response(companyExposition(), {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const token = accessToken(COMPANY);
    const snapshot = await fetchAuthMetricsSnapshot(token);
    expect(snapshot.usersTotal).toBe(8);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('surfaces a forbidden company scrape as an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } }),
      ),
    );
    await expect(fetchStaffPrometheusMetrics(accessToken(COMPANY))).rejects.toThrow(/Forbidden/);
  });
});
