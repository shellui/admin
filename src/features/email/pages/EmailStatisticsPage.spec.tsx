import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { EmailStatisticsPage } from '@/features/email/pages/EmailStatisticsPage';
import { EmailApiError } from '@/lib/emailApiErrors';
import type { EmailMetricsSnapshot } from '@/lib/emailMetrics';
import type { EmailStats } from '@/lib/emailTypes';

const stats: EmailStats = {
  companyId: 42,
  from: '2026-09-02T00:00:00Z',
  to: '2026-10-02T00:00:00Z',
  totals: {
    sent: 1,
    delivered: 1,
    bounced: 0,
    complained: 0,
    expired: 0,
    failed: 0,
    queued: 0,
    suppressed: 0,
    cancelled: 0,
  },
  skipped: { total: 0, noRecipients: 0, ruleDisabled: 0 },
  byLane: {},
  byEvent: {},
  byDay: [],
};

const metrics: EmailMetricsSnapshot = {
  queueDepth: {},
  queueAgeSeconds: {},
  latency: {},
  providerErrors: [],
  authTtlExpiries: 0,
};

const api = vi.hoisted(() => ({
  fetchStats: vi.fn(),
  fetchMetrics: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'token',
}));

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({
    api,
    companyId: 42,
    baseUrl: 'https://email.shellui.com',
    canManage: true,
  }),
}));

describe('EmailStatisticsPage', () => {
  afterEach(async () => {
    cleanup();
    api.fetchStats.mockReset();
    api.fetchMetrics.mockReset();
    await i18n.changeLanguage('en');
  });

  it('keeps a load failure at the top of the page', async () => {
    api.fetchStats.mockRejectedValue(new EmailApiError('request_failed', 503));
    api.fetchMetrics.mockResolvedValue(metrics);
    render(
      <I18nextProvider i18n={i18n}>
        <EmailStatisticsPage />
      </I18nextProvider>,
    );
    const failure = await screen.findByText('The email request failed.');
    expect(failure.className).toContain('text-destructive');
    expect(screen.queryByText('Statistics refreshed.')).toBeNull();
  });

  it('shows a refresh failure under Refresh and leaves the page banner clear', async () => {
    api.fetchStats
      .mockResolvedValueOnce(stats)
      .mockRejectedValueOnce(new EmailApiError('request_failed', 503));
    api.fetchMetrics.mockResolvedValue(metrics);
    render(
      <I18nextProvider i18n={i18n}>
        <EmailStatisticsPage />
      </I18nextProvider>,
    );
    const refresh = await screen.findByRole('button', { name: 'Refresh' });
    expect(screen.queryByText('The email request failed.')).toBeNull();
    fireEvent.click(refresh);
    const failure = await screen.findByText('The email request failed.');
    expect(refresh.parentElement?.parentElement?.contains(failure)).toBe(true);
    expect(screen.getAllByText('The email request failed.')).toHaveLength(1);

    api.fetchStats.mockResolvedValue(stats);
    fireEvent.click(refresh);
    const sent = await screen.findByText('Statistics refreshed.');
    expect(refresh.parentElement?.parentElement?.contains(sent)).toBe(true);
    expect(sent.className).not.toContain('text-destructive');
  });
});
