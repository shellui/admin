import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { DashboardAiSection } from '@/components/DashboardAiSection';
import type { AiDashboardSnapshot } from '@/lib/dashboardAi';

const state = vi.hoisted(() => {
  const defaultSnapshot = (): AiDashboardSnapshot => ({
    metrics: {
      agentCounts: { active: 3, paused: 0, revoked: 1, expired: 0 },
      pendingApprovals: 2,
      callLogs24h: 12,
      callLogErrors24h: 1,
    },
    quiet: null,
  });
  return {
    enabled: true,
    accessToken: 'token' as string | null,
    companyId: 42 as number | null,
    snapshot: defaultSnapshot(),
    defaultSnapshot,
  };
});

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => state.accessToken,
}));

vi.mock('@/hooks/useShelluiAiService', () => ({
  useShelluiAiService: () =>
    state.enabled ? { url: 'http://localhost:8010', showInAdmin: true } : null,
}));

vi.mock('@/lib/jwtCompany', () => ({
  getCompanyIdFromJwt: () => state.companyId,
}));

vi.mock('@/lib/dashboardAi', () => ({
  loadAiDashboardSnapshot: vi.fn(async () => state.snapshot),
}));

function renderSection() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <DashboardAiSection />
        <p>Email still here</p>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('DashboardAiSection', () => {
  afterEach(async () => {
    cleanup();
    state.enabled = true;
    state.accessToken = 'token';
    state.companyId = 42;
    state.snapshot = state.defaultSnapshot();
    await i18n.changeLanguage('en');
  });

  it('shows four KPI cards and a link to AI status', async () => {
    renderSection();
    expect(await screen.findByText('3')).toBeTruthy();
    expect(screen.getByText('Active agents')).toBeTruthy();
    expect(screen.getByText('1 revoked.')).toBeTruthy();
    expect(screen.getByText('Pending approvals')).toBeTruthy();
    expect(screen.getByText('Calls (24h)')).toBeTruthy();
    expect(screen.getByText('Failed (24h)')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Open status' });
    expect(link.getAttribute('href')).toBe('/ai');
    expect(
      screen.getByText('Counts come from company MCP agents and the last 24 hours of call logs.'),
    ).toBeTruthy();
    expect(screen.getByText('Email still here')).toBeTruthy();
  });

  it('uses the connected hint when no agents are revoked', async () => {
    state.snapshot = {
      metrics: {
        agentCounts: { active: 2, paused: 1, revoked: 0, expired: 0 },
        pendingApprovals: 0,
        callLogs24h: 0,
        callLogErrors24h: 0,
      },
      quiet: null,
    } satisfies AiDashboardSnapshot;
    renderSection();
    expect(await screen.findByText('Connected MCP agents.')).toBeTruthy();
    expect(screen.queryByText(/revoked/)).toBeNull();
  });

  it('hides the block when AI is hidden in Admin', async () => {
    state.enabled = false;
    renderSection();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'AI' })).toBeNull());
    expect(screen.getByText('Email still here')).toBeTruthy();
  });

  it('shows a quiet empty state when MCP data is unavailable', async () => {
    state.snapshot = { metrics: null, quiet: 'unavailable' } satisfies AiDashboardSnapshot;
    renderSection();
    const note = await screen.findByText('AI metrics are unavailable right now.');
    expect(note.className).not.toContain('text-destructive');
    expect(screen.queryByText('Active agents')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open status' })).toBeTruthy();
  });
});
