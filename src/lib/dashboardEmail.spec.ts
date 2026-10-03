import { describe, expect, it, vi } from 'vitest';
import { EmailApiError } from '@/lib/emailApiErrors';
import { loadEmailDashboardSnapshot } from '@/lib/dashboardEmail';
import type { EmailProviderSettings, EmailStats } from '@/lib/emailTypes';

const stats: EmailStats = {
  companyId: 42,
  from: '2026-09-02T00:00:00Z',
  to: '2026-10-02T00:00:00Z',
  totals: {
    sent: 8,
    delivered: 6,
    bounced: 1,
    complained: 2,
    expired: 0,
    failed: 1,
    queued: 0,
    suppressed: 3,
    cancelled: 0,
  },
  skipped: { total: 0, noRecipients: 0, ruleDisabled: 0 },
  byLane: {},
  byEvent: {},
  byDay: [],
};

function provider(configured: boolean): EmailProviderSettings {
  return {
    companyId: 42,
    configured,
    provider: configured ? 'resend' : null,
    fromEmail: 'no-reply@acme.com',
    fromName: '',
    sendingDomain: '',
    bulkFromEmail: '',
    credentialsHint: '',
    webhookConfigured: false,
    webhookHint: '',
    fallbackProvider: 'resend',
    fallbackConfigured: true,
    smtpAllowed: false,
    authLinkHosts: [],
  };
}

describe('loadEmailDashboardSnapshot', () => {
  it('returns delivery totals when the company provider is configured', async () => {
    const snapshot = await loadEmailDashboardSnapshot({
      fetchStats: vi.fn(async () => stats),
      fetchProvider: vi.fn(async () => provider(true)),
    });
    expect(snapshot.quiet).toBeNull();
    expect(snapshot.stats?.totals.sent).toBe(8);
    expect(snapshot.stats?.totals.complained).toBe(2);
    expect(snapshot.stats?.totals.suppressed).toBe(3);
  });

  it('stays quiet when the company has no provider, even if stats loaded', async () => {
    const snapshot = await loadEmailDashboardSnapshot({
      fetchStats: vi.fn(async () => stats),
      fetchProvider: vi.fn(async () => provider(false)),
    });
    expect(snapshot).toEqual({ stats: null, quiet: 'no_provider' });
  });

  it('maps provider_not_configured to the quiet empty state', async () => {
    const snapshot = await loadEmailDashboardSnapshot({
      fetchStats: vi.fn(async () => {
        throw new EmailApiError('provider_not_configured', 409);
      }),
      fetchProvider: vi.fn(async () => {
        throw new EmailApiError('provider_not_configured', 409, {});
      }),
    });
    expect(snapshot).toEqual({ stats: null, quiet: 'no_provider' });
  });

  it('stays quiet when email-service is unreachable and does not throw', async () => {
    const snapshot = await loadEmailDashboardSnapshot({
      fetchStats: vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
      fetchProvider: vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    });
    expect(snapshot).toEqual({ stats: null, quiet: 'unavailable' });
  });

  it('keeps loaded stats when the provider check fails for another reason', async () => {
    const snapshot = await loadEmailDashboardSnapshot({
      fetchStats: vi.fn(async () => stats),
      fetchProvider: vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    });
    expect(snapshot.quiet).toBeNull();
    expect(snapshot.stats?.totals.failed).toBe(1);
  });
});
