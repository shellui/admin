import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHostingMetricsSnapshot, parseHostingStatsSnapshot } from '@/lib/hostingMetricsApi';

function accessToken(companyId: number): string {
  const payload = btoa(JSON.stringify({ company_id: companyId }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `header.${payload}.sig`;
}

describe('parseHostingStatsSnapshot', () => {
  it('maps JSON hosting stats including expiry and deployment windows', () => {
    const snap = parseHostingStatsSnapshot({
      apps: 4,
      apps_expired: 1,
      deployments: 12,
      active_deployments: 3,
      artifact_bytes: 8192,
      deployments_24h: 2,
      deployments_7d: 5,
      deployments_30d: 10,
      access: { pending: 1, approved: 2, denied: 0 },
    });
    expect(snap).toEqual({
      appsTotal: 4,
      appsExpired: 1,
      deploymentsTotal: 12,
      activeDeployments: 3,
      artifactBytes: 8192,
      deployments24h: 2,
      deployments7d: 5,
      deployments30d: 10,
      accessPending: 1,
      accessApproved: 2,
      accessDenied: 0,
    });
  });
});

describe('fetchHostingMetricsSnapshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls GET /hosting/v1/stats', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toBe('https://hosting.example.com/hosting/v1/stats');
      return new Response(
        JSON.stringify({
          apps: 2,
          apps_expired: 0,
          deployments: 3,
          active_deployments: 2,
          artifact_bytes: 512,
          deployments_24h: 1,
          deployments_7d: 2,
          deployments_30d: 3,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const snap = await fetchHostingMetricsSnapshot('https://hosting.example.com/', accessToken(10));
    expect(snap.appsTotal).toBe(2);
    expect(snap.artifactBytes).toBe(512);
    expect(snap.deployments7d).toBe(2);
  });
});
