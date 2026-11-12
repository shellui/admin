import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { AiStatusPage } from '@/features/ai/pages/AiStatusPage';

const mocks = vi.hoisted(() => ({
  aiUrl: 'http://localhost:8010',
  accessToken: 'token',
  companyId: 42,
  fetchCompanyMcpAgents: vi.fn(async () => [
    {
      id: '1',
      name: 'Agent',
      access_mode: 'ask',
      read_level: 'safe',
      allow_destructive_without_asking: false,
      services_allowed: [],
      project_scope: '',
      expires_at: null,
      paused_at: null,
      revoked_at: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ]),
  fetchCompanyMcpApprovals: vi.fn(async () => [{ id: 'p1' }]),
  fetchCompanyMcpCallLogs: vi.fn(async () => ({
    count: 1,
    limit: 200,
    offset: 0,
    call_logs: [
      {
        id: 1,
        agent_id: '1',
        agent_name: 'Agent',
        service: 'storage',
        tool_name: 'list_files',
        status: 'allowed',
        status_code: 200,
        duration_ms: 12,
        arguments: {},
        created_at: new Date().toISOString(),
        wrapper_tool: '',
        error_message: '',
        error_code: '',
        approval_channel: 'none',
        approval_outcome: '',
      },
    ],
  })),
}));

vi.mock('@/hooks/useShelluiAiService', () => ({
  useShelluiAiService: () => ({ url: mocks.aiUrl, showInAdmin: true }),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => mocks.accessToken,
}));

vi.mock('@/lib/jwtCompany', () => ({
  getCompanyIdFromJwt: () => mocks.companyId,
}));

vi.mock('@/lib/companyAgentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/companyAgentsApi')>();
  return {
    ...actual,
    fetchCompanyMcpAgents: mocks.fetchCompanyMcpAgents,
    fetchCompanyMcpApprovals: mocks.fetchCompanyMcpApprovals,
    fetchCompanyMcpCallLogs: mocks.fetchCompanyMcpCallLogs,
    isMcpApiUnavailable: () => false,
  };
});

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <AiStatusPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('AiStatusPage', () => {
  afterEach(async () => {
    cleanup();
    mocks.accessToken = 'token';
    await i18n.changeLanguage('en');
  });

  it('shows MCP reachability and activity stats without a browser health fetch error', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Reachable')).toBeTruthy();
    });
    expect(screen.getByText('Active agents')).toBeTruthy();
    expect(mocks.fetchCompanyMcpAgents).toHaveBeenCalled();
    expect(screen.queryByText(/NetworkError/i)).toBeNull();
  });

  it('uses a statistics title in English and French', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'AI statistics' })).toBeTruthy();

    await i18n.changeLanguage('fr');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Statistiques IA' })).toBeTruthy();
    });
  });

  it('does not call ai-service /health/live from the page', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Reachable')).toBeTruthy();
    });
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/health/live'))).toBe(false);
    fetchSpy.mockRestore();
  });
});
