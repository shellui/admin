import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentsPage } from '@/features/agents/pages/AgentsPage';
import { TooltipProvider } from '@/components/ui/tooltip';

function renderAgentsPage() {
  return render(
    <TooltipProvider>
      <AgentsPage />
    </TooltipProvider>,
  );
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts?.name) return `${key}:${opts.name}`;
      if (opts?.arguments) return `${key}:${opts.arguments}`;
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

vi.mock('@/lib/jwtCompany', () => ({
  getCompanyIdFromJwt: () => 1,
  getIsCompanyOwnerFromJwt: () => true,
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
        expires_at: null,
        paused_at: null,
        revoked_at: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
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
        duration_ms: 1,
        arguments: { note: '<b>bold</b>' },
        created_at: '2026-01-01T00:00:00Z',
      },
    ]),
    fetchMcpDiscoveredServices: vi.fn().mockResolvedValue([]),
  };
});

describe('AgentsPage', () => {
  it('renders agent names and call log arguments as plain text', async () => {
    renderAgentsPage();
    await screen.findByText('<img src=x onerror=alert(1)>');
    expect(document.body.textContent).toContain('<b>bold</b>');
    expect(document.querySelector('b')).toBeNull();
    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(screen.getByText('agentsPageIntroMcp')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'agentsDocsLink' }).getAttribute('href')).toBe(
      'https://docs.shellui.com/identity/mcp-and-agents/',
    );
    expect(
      screen.getByRole('tab', { name: 'agentsClientTab_cursor' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(document.body.textContent).toContain('https://ai.example.com/c/1/mcp');
  });
});
