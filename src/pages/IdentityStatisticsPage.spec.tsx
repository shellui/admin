import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { IdentityStatisticsPage } from '@/pages/IdentityStatisticsPage';
import type { AuthMetricsSnapshot } from '@/lib/authMetricsApi';

const snapshot: AuthMetricsSnapshot = {
  rawText: '',
  usersTotal: 8,
  usersActive: 6,
  usersStaff: 1,
  socialAccountsTotal: 3,
  dailyActiveUsers: 2,
  weeklyActiveUsers: 4,
  monthlyActiveUsers: 5,
  successfulLogins: [
    { provider: 'google', total: 4 },
    { provider: 'magic_link', total: 1 },
  ],
};

const hooks = vi.hoisted(() => ({ isStaff: false, token: 'token' as string | null }));
const authApi = vi.hoisted(() => ({ fetchAuthMetricsSnapshot: vi.fn() }));
const jobsApi = vi.hoisted(() => ({
  fetchScheduledJobs: vi.fn(),
  fetchScheduledJobRuns: vi.fn(),
  fetchScheduledJobRun: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => hooks.token,
}));
vi.mock('@/hooks/useShelluiIsStaff', () => ({
  useShelluiIsStaff: () => hooks.isStaff,
}));
vi.mock('@/lib/authMetricsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/authMetricsApi')>();
  return { ...actual, fetchAuthMetricsSnapshot: authApi.fetchAuthMetricsSnapshot };
});
vi.mock('@/lib/scheduledJobsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/scheduledJobsApi')>();
  return { ...actual, ...jobsApi };
});

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <IdentityStatisticsPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('IdentityStatisticsPage', () => {
  afterEach(async () => {
    cleanup();
    hooks.isStaff = false;
    hooks.token = 'token';
    authApi.fetchAuthMetricsSnapshot.mockReset();
    jobsApi.fetchScheduledJobs.mockReset();
    await i18n.changeLanguage('en');
  });

  it('shows company metrics and labels sign-ins as since process start', async () => {
    authApi.fetchAuthMetricsSnapshot.mockResolvedValue(snapshot);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Identity statistics' })).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('google')).toBeTruthy();
    expect(screen.getByText('magic_link')).toBeTruthy();
    expect(screen.getByText(/since this identity-service process started/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the event log' }).getAttribute('href')).toBe(
      '/events',
    );
    expect(screen.queryByText('Scheduled jobs')).toBeNull();
    expect(jobsApi.fetchScheduledJobs).not.toHaveBeenCalled();
  });

  it('shows a load error inline and clears it after a successful refresh', async () => {
    authApi.fetchAuthMetricsSnapshot
      .mockRejectedValueOnce(new Error('Request failed (503)'))
      .mockResolvedValueOnce(snapshot);
    renderPage();
    const failure = await screen.findByRole('alert');
    expect(failure.textContent).toBe('Request failed (503)');
    expect(failure.className).toContain('text-destructive');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('google')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('explains a forbidden company scrape', async () => {
    authApi.fetchAuthMetricsSnapshot.mockRejectedValue(new Error('Forbidden'));
    renderPage();
    expect((await screen.findByRole('alert')).textContent).toMatch(/staff or company-owner access/);
  });

  it('shows scheduled jobs to staff only', async () => {
    hooks.isStaff = true;
    authApi.fetchAuthMetricsSnapshot.mockResolvedValue(snapshot);
    jobsApi.fetchScheduledJobs.mockResolvedValue({
      generated_at: new Date().toISOString(),
      scheduler_enabled: true,
      redis_reachable: true,
      beat_last_seen_at: new Date().toISOString(),
      beat_stale: false,
      jobs: [],
    });
    renderPage();
    expect(await screen.findByText('Scheduled jobs')).toBeTruthy();
    expect(screen.getByText(/identity-service maintenance jobs/)).toBeTruthy();
    expect(jobsApi.fetchScheduledJobs).toHaveBeenCalledWith('token');
  });

  it('uses the French title', async () => {
    await i18n.changeLanguage('fr');
    authApi.fetchAuthMetricsSnapshot.mockResolvedValue({ ...snapshot, successfulLogins: [] });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Statistiques d’identité' })).toBeTruthy();
    expect(
      screen.getByText('Aucune connexion réussie depuis le démarrage de ce processus.'),
    ).toBeTruthy();
  });
});
