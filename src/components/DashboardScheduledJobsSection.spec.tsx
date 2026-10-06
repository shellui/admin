import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { DashboardScheduledJobsSection } from '@/components/DashboardScheduledJobsSection';
import type {
  ScheduledJobRun,
  ScheduledJobRunDetail,
  ScheduledJobsOverview,
} from '@/lib/scheduledJobsApi';

const hooks = vi.hoisted(() => ({ isStaff: true, token: 'tok' as string | null, companyId: 7 }));

vi.mock('@/hooks/useShelluiIsStaff', () => ({ useShelluiIsStaff: () => hooks.isStaff }));
vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => hooks.token,
}));
vi.mock('@/lib/jwtCompany', () => ({ getCompanyIdFromJwt: () => hooks.companyId }));

const api = vi.hoisted(() => ({
  fetchScheduledJobs: vi.fn(),
  fetchScheduledJobRuns: vi.fn(),
  fetchScheduledJobRun: vi.fn(),
}));
vi.mock('@/lib/scheduledJobsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/scheduledJobsApi')>();
  return { ...actual, ...api };
});

const { ScheduledJobsForbiddenError } = await import('@/lib/scheduledJobsApi');

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function run(overrides: Partial<ScheduledJobRun> = {}): ScheduledJobRun {
  return {
    id: 11,
    job: 'retry_webhooks',
    trigger: 'celery',
    status: 'succeeded',
    started_at: minutesAgo(1),
    finished_at: minutesAgo(1),
    duration_ms: 120,
    counts: { webhook_deliveries_attempted: 2, webhook_deliveries_succeeded: 2 },
    error_key: null,
    error_class: null,
    error_message: null,
    host: 'web-1',
    request_id: 'sjr-11',
    event_log_id: 5,
    ...overrides,
  };
}

function overview(overrides: Partial<ScheduledJobsOverview> = {}): ScheduledJobsOverview {
  const failed = run({
    id: 21,
    job: 'purge_expired_data',
    trigger: 'command',
    status: 'failed',
    started_at: minutesAgo(150),
    counts: {},
    error_key: 'database_error',
    error_class: 'OperationalError',
    error_message: 'server closed the connection',
  });
  return {
    generated_at: new Date().toISOString(),
    scheduler_enabled: true,
    redis_reachable: true,
    beat_last_seen_at: minutesAgo(1),
    beat_stale: false,
    jobs: [
      {
        job: 'retry_webhooks',
        health: 'healthy',
        overdue: false,
        interval_seconds: 60,
        overdue_after_seconds: 180,
        last_run: run(),
        last_success_at: minutesAgo(1),
        last_failure_at: null,
        last_skipped_at: null,
        last_duration_ms: 120,
        last_counts: run().counts,
        next_expected_at: new Date(Date.now() + 60_000).toISOString(),
        last_24h: { succeeded: 1400, failed: 0 },
        skipped_locked_total: 3,
      },
      {
        job: 'purge_expired_data',
        health: 'failing',
        overdue: true,
        interval_seconds: 3600,
        overdue_after_seconds: 8100,
        last_run: failed,
        last_success_at: minutesAgo(200),
        last_failure_at: minutesAgo(150),
        last_skipped_at: null,
        last_duration_ms: 50,
        last_counts: { events: 4 },
        next_expected_at: null,
        last_24h: { succeeded: 20, failed: 3 },
        skipped_locked_total: 0,
      },
    ],
    ...overrides,
  };
}

function renderSection() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <DashboardScheduledJobsSection />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  hooks.isStaff = true;
  hooks.token = 'tok';
  hooks.companyId = 7;
  await i18n.changeLanguage('en');
  api.fetchScheduledJobs.mockResolvedValue(overview());
  api.fetchScheduledJobRuns.mockImplementation(async (_t: string, job: string) =>
    job === 'retry_webhooks' ? [run()] : [overview().jobs[1].last_run],
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DashboardScheduledJobsSection', () => {
  it('renders nothing and calls no API for non-staff users', () => {
    hooks.isStaff = false;
    const { container } = renderSection();
    expect(container.innerHTML).toBe('');
    expect(api.fetchScheduledJobs).not.toHaveBeenCalled();
  });

  it('hides itself when the API answers 403', async () => {
    api.fetchScheduledJobs.mockRejectedValue(new ScheduledJobsForbiddenError('Staff only.'));
    const { container } = renderSection();
    await waitFor(() => expect(api.fetchScheduledJobs).toHaveBeenCalled());
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('shows health badges, scheduler status and recent runs for staff', async () => {
    renderSection();
    const retry = await screen.findByTestId('scheduled-job-retry_webhooks');
    const purge = screen.getByTestId('scheduled-job-purge_expired_data');

    expect(within(retry).getByText('Healthy')).toBeTruthy();
    expect(within(purge).getByText('Failing')).toBeTruthy();
    expect(within(purge).getByText('Overdue')).toBeTruthy();
    expect(within(purge).getByText('Database error')).toBeTruthy();
    expect(within(retry).getByText('1400 ok · 0 failed')).toBeTruthy();
    expect(within(retry).getByText('Webhooks delivered: 2', { exact: false })).toBeTruthy();

    expect(screen.getByText('Built-in scheduler on')).toBeTruthy();
    expect(screen.getByText('Redis reachable')).toBeTruthy();
    expect(api.fetchScheduledJobRuns).toHaveBeenCalledWith('tok', 'retry_webhooks', 10);
  });

  it('shows the cron and no-broker states', async () => {
    api.fetchScheduledJobs.mockResolvedValue(
      overview({ scheduler_enabled: false, redis_reachable: null, beat_last_seen_at: null }),
    );
    renderSection();
    expect(await screen.findByText('Built-in scheduler off (external cron)')).toBeTruthy();
    expect(screen.getByText('No Redis broker')).toBeTruthy();
    expect(screen.queryByText('Beat never seen')).toBeNull();
  });

  it('shows a load error inline next to the refresh button and recovers on retry', async () => {
    api.fetchScheduledJobs.mockRejectedValueOnce(new Error('Request failed (502)'));
    renderSection();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load scheduled jobs. Request failed (502)');
    const refresh = screen.getByRole('button', { name: 'Refresh' });
    expect(refresh.parentElement?.contains(alert)).toBe(true);

    fireEvent.click(refresh);
    await screen.findByTestId('scheduled-job-retry_webhooks');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('expands a run to list correlated webhooks and emails', async () => {
    const detail: ScheduledJobRunDetail = {
      ...run(),
      webhook_delivery_attempts: [
        {
          id: 1,
          delivery_id: 'd-own',
          company_id: 7,
          event_type: 'identity.user.created',
          status: 'success',
          http_status: 200,
          attempt_number: 2,
          duration_ms: 30,
          trigger: 'automatic_retry',
          created_at: minutesAgo(1),
        },
        {
          id: 2,
          delivery_id: 'd-other',
          company_id: 9,
          event_type: 'identity.user.deleted',
          status: 'failure',
          http_status: 500,
          attempt_number: 3,
          duration_ms: 30,
          trigger: 'automatic_retry',
          created_at: minutesAgo(1),
        },
      ],
      webhook_delivery_attempts_truncated: false,
      email_events: [
        {
          id: 'e1',
          company_id: 7,
          event_type: 'identity.user.created',
          status: 'delivered',
          attempt_count: 2,
          delivered_at: minutesAgo(1),
        },
      ],
      email_events_truncated: false,
    };
    api.fetchScheduledJobRun.mockResolvedValue(detail);
    renderSection();
    const retry = await screen.findByTestId('scheduled-job-retry_webhooks');
    fireEvent.click(within(retry).getByRole('button', { name: /Details/ }));

    expect(await within(retry).findByText('2 webhook delivery attempts')).toBeTruthy();
    expect(api.fetchScheduledJobRun).toHaveBeenCalledWith('tok', 11);
    expect(within(retry).getByText('1 email-service event')).toBeTruthy();
    expect(within(retry).getByText('Log id: sjr-11')).toBeTruthy();
    const link = within(retry).getByRole('link', { name: 'Open delivery' });
    expect(link.getAttribute('href')).toContain('d-own');
    expect(within(retry).getByText('Company #9')).toBeTruthy();
    expect(within(retry).getByText('This company')).toBeTruthy();
  });

  it('is translated in French', async () => {
    await i18n.changeLanguage('fr');
    renderSection();
    expect(await screen.findByText('Tâches planifiées')).toBeTruthy();
    expect(screen.getByText('En échec')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Actualiser' })).toBeTruthy();
  });
});
