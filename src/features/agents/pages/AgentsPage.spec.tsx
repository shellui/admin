import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentsPage } from '@/features/agents/pages/AgentsPage';

function renderAgentsPage() {
  return render(<AgentsPage />);
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'agentsCallCount' && typeof opts?.count === 'number') {
        if (opts.count === 0) return '0 calls';
        if (opts.count === 1) return '1 call';
        return `${opts.count} calls`;
      }
      if (opts?.name && opts?.date) return `${key}:${opts.name}:${opts.date}`;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'tok',
}));

vi.mock('@/hooks/useShelluiAiService', () => ({
  useShelluiAiService: () => ({ url: 'https://ai.example.com' }),
}));

vi.mock('@/hooks/useEventRetention', () => ({
  useEventLogSource: () => ({ service: 'identity', baseUrl: 'https://id.example' }),
  useEventRetention: () => ({ data_retention_days: 30, stale_events: false }),
}));

vi.mock('@/lib/jwtCompany', () => ({
  getCompanyIdFromJwt: () => 1,
  getIsCompanyOwnerFromJwt: () => true,
}));

vi.mock('@/lib/personalAgentsApi', () => ({
  fetchMcpPersonalStatus: vi.fn().mockResolvedValue({
    mcp_enabled: true,
    mcp_url: 'https://ai.example.com/c/1/mcp',
    global_identity: false,
  }),
  createMcpPersonalAgent: vi.fn(),
}));

vi.mock('@/lib/companyAgentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/companyAgentsApi')>();
  return {
    ...actual,
    fetchCompanyMcpAgents: vi.fn().mockResolvedValue([
      {
        id: 'a1',
        name: '<img src=x onerror=alert(1)>',
        access_mode: 'full',
        read_level: 'safe',
        allow_destructive_without_asking: true,
        services_allowed: ['identity'],
        project_scope: 'test',
        expires_at: '2026-12-01T00:00:00Z',
        paused_at: null,
        revoked_at: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        created_by: { display_name: 'Owner' },
      },
    ]),
    fetchCompanyMcpApprovals: vi.fn().mockResolvedValue([]),
    fetchCompanyMcpCallLogs: vi.fn().mockResolvedValue([
      {
        id: 1,
        agent_id: 'a1',
        agent_name: '<script>alert(1)</script>',
        service: 'identity',
        tool: 'list_users',
        method: 'GET',
        path: '/users',
        status_code: 200,
        duration_ms: 50,
        arguments: { note: '<b>bold</b>' },
        created_at: new Date(Date.now() - 60_000).toISOString(),
      },
    ]),
    fetchMcpDiscoveredServices: vi.fn().mockResolvedValue([]),
  };
});

describe('AgentsPage', () => {
  it('renders agent names as plain text and shows per-agent call log on expand', async () => {
    renderAgentsPage();
    await screen.findByText('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(screen.getByText('agentsPageDescription')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'agentsConnectOpen' })).toBeTruthy();
    expect(screen.getByText('agentsRetentionBanner')).toBeTruthy();

    const expand = screen.getByRole('button', { name: 'agentsExpandAgent' });
    fireEvent.click(expand);

    const log = await screen.findByText('list_users');
    expect(log).toBeTruthy();
    const table = log.closest('table')!;
    expect(within(table).getByText('50 ms')).toBeTruthy();
    const statusBadge = within(table).getByText('agentsLogStatusSucceeded');
    expect(statusBadge.className).toContain('bg-emerald-500/10');
    expect(document.body.textContent).not.toContain('<b>bold</b>');
  });
});
