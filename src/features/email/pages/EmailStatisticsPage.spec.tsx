import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { EmailStatisticsPage } from '@/features/email/pages/EmailStatisticsPage';
import { EmailApiError } from '@/lib/emailApiErrors';
import { ScheduledJobsForbiddenError } from '@/lib/scheduledJobsApi';
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

const hooks = vi.hoisted(() => ({ isStaff: false }));

const api = vi.hoisted(() => ({
  fetchStats: vi.fn(),
  fetchMetrics: vi.fn(),
}));

const jobsApi = vi.hoisted(() => ({
  fetchScheduledJobs: vi.fn(),
  fetchScheduledJobRuns: vi.fn(),
  fetchScheduledJobRun: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'token',
}));

vi.mock('@/hooks/useShelluiIsStaff', () => ({
  useShelluiIsStaff: () => hooks.isStaff,
}));

vi.mock('@/lib/scheduledJobsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/scheduledJobsApi')>();
  return { ...actual, ...jobsApi };
});

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({
    api,
    companyId: 42,
    baseUrl: 'https://email.shellui.com',
    canManage: true,
  }),
}));

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <EmailStatisticsPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EmailStatisticsPage', () => {
  afterEach(async () => {
    cleanup();
    hooks.isStaff = false;
    api.fetchStats.mockReset();
    api.fetchMetrics.mockReset();
    jobsApi.fetchScheduledJobs.mockReset();
    jobsApi.fetchScheduledJobRuns.mockReset();
    await i18n.changeLanguage('en');
  });

  it('keeps a load failure at the top of the page', async () => {
    api.fetchStats.mockRejectedValue(new EmailApiError('request_failed', 503));
    api.fetchMetrics.mockResolvedValue(metrics);
    renderPage();
    const failure = await screen.findByText('The email request failed.');
    expect(failure.closest('[role="alert"]')).toBeTruthy();
    expect(screen.queryByText('Statistics refreshed.')).toBeNull();
  });

  it('shows a refresh failure under Refresh and leaves the page banner clear', async () => {
    api.fetchStats
      .mockResolvedValueOnce(stats)
      .mockRejectedValueOnce(new EmailApiError('request_failed', 503));
    api.fetchMetrics.mockResolvedValue(metrics);
    renderPage();
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

  it('hides scheduled jobs for a company owner', async () => {
    api.fetchStats.mockResolvedValue(stats);
    api.fetchMetrics.mockResolvedValue(metrics);
    renderPage();
    await screen.findByRole('button', { name: 'Refresh' });
    expect(screen.queryByText('Scheduled jobs')).toBeNull();
    expect(jobsApi.fetchScheduledJobs).not.toHaveBeenCalled();
  });

  it('shows email scheduled jobs to staff and hides them on 403', async () => {
    hooks.isStaff = true;
    api.fetchStats.mockResolvedValue(stats);
    api.fetchMetrics.mockResolvedValue(metrics);
    jobsApi.fetchScheduledJobs.mockResolvedValue({
      generated_at: new Date().toISOString(),
      scheduler_enabled: true,
      redis_reachable: true,
      beat_last_seen_at: new Date().toISOString(),
      beat_stale: false,
      jobs: [
        {
          job: 'retry_webhooks',
          health: 'healthy',
          overdue: false,
          interval_seconds: 60,
          overdue_after_seconds: 180,
          last_run: null,
          last_success_at: null,
          last_failure_at: null,
          last_skipped_at: null,
          last_duration_ms: null,
          last_counts: {},
          next_expected_at: null,
          last_24h: { succeeded: 1, failed: 0 },
          skipped_locked_total: 0,
        },
        {
          job: 'sweep_email_queue',
          health: 'healthy',
          overdue: false,
          interval_seconds: 60,
          overdue_after_seconds: 180,
          last_run: null,
          last_success_at: null,
          last_failure_at: null,
          last_skipped_at: null,
          last_duration_ms: null,
          last_counts: { expired: 1, released: 0, broadcasts: 2 },
          next_expected_at: null,
          last_24h: { succeeded: 1, failed: 0 },
          skipped_locked_total: 0,
        },
        {
          job: 'purge_expired_data',
          health: 'healthy',
          overdue: false,
          interval_seconds: 3600,
          overdue_after_seconds: 8100,
          last_run: null,
          last_success_at: null,
          last_failure_at: null,
          last_skipped_at: null,
          last_duration_ms: null,
          last_counts: {},
          next_expected_at: null,
          last_24h: { succeeded: 0, failed: 0 },
          skipped_locked_total: 0,
        },
      ],
    });
    jobsApi.fetchScheduledJobRuns.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Scheduled jobs')).toBeTruthy();
    expect(screen.getByText(/email-service maintenance jobs/)).toBeTruthy();
    expect(screen.getByText('Sweep the email queue')).toBeTruthy();
    expect(screen.getByText('Retry webhooks')).toBeTruthy();
    expect(screen.getByText(/retries failed webhook deliveries\./)).toBeTruthy();
    expect(screen.queryByText(/email-service event posts/)).toBeNull();
    expect(screen.getByText('Purge expired data')).toBeTruthy();
    expect(jobsApi.fetchScheduledJobs).toHaveBeenCalledWith('token', 'https://email.shellui.com');

    cleanup();
    jobsApi.fetchScheduledJobs.mockRejectedValue(new ScheduledJobsForbiddenError('Staff only.'));
    renderPage();
    await screen.findByRole('heading', { name: 'Email statistics' });
    await waitFor(() => expect(screen.queryByText('Scheduled jobs')).toBeNull());
  });
});
