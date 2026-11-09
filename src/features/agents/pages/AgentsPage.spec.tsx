import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import shellui from '@shellui/sdk';
import { notifyAgentsChanged } from '@/lib/agentConnectDrawer';
import { fetchCompanyMcpAgents, MCP_API_UNAVAILABLE } from '@/lib/companyAgentsApi';
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
      if (typeof opts?.services === 'string') return `${key}:${opts.services}`;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'tok',
}));

vi.mock('@/hooks/useEventRetention', () => ({
  useEventLogSource: () => ({ service: 'identity', baseUrl: 'https://id.example' }),
  useEventRetention: () => ({ data_retention_days: 30, stale_events: false }),
}));

vi.mock('@/lib/jwtCompany', () => ({
  getCompanyIdFromJwt: () => 1,
  getIsCompanyOwnerFromJwt: () => true,
}));

const personal = vi.hoisted(() => ({
  fetchMcpPersonalAgents: vi.fn(),
  revokeMcpPersonalAgent: vi.fn(),
}));

vi.mock('@/lib/personalAgentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/personalAgentsApi')>();
  return {
    ...actual,
    fetchMcpPersonalAgents: personal.fetchMcpPersonalAgents,
    revokeMcpPersonalAgent: personal.revokeMcpPersonalAgent,
  };
});

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

function personalRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'oauth-1',
    kind: 'oauth',
    name: 'Cursor laptop',
    access_mode: 'ask',
    read_level: 'safe',
    allow_destructive_without_asking: false,
    services_allowed: ['identity', 'storage'],
    expires_at: '2026-12-01T00:00:00Z',
    paused_at: null,
    revoked_at: null,
    is_active: true,
    created_at: '2026-06-01T00:00:00Z',
    oauth_client_id: 'client-1',
    personal_token_id: null,
    ...overrides,
  };
}

describe('AgentsPage', () => {
  beforeEach(() => {
    personal.fetchMcpPersonalAgents.mockReset();
    personal.revokeMcpPersonalAgent.mockReset();
    personal.fetchMcpPersonalAgents.mockResolvedValue([]);
    vi.mocked(fetchCompanyMcpAgents).mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.mocked(shellui.openDrawer).mockClear();
  });

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

  it('opens the shell drawer and does not render the connect form in this frame', async () => {
    renderAgentsPage();
    const open = await screen.findByRole('button', { name: 'agentsConnectOpen' });
    fireEvent.click(open);
    expect(vi.mocked(shellui.openDrawer)).toHaveBeenCalledTimes(1);
    const options = vi.mocked(shellui.openDrawer).mock.calls[0]?.[0];
    expect(options).toMatchObject({ position: 'right', size: 'md' });
    expect(options?.url).toMatch(/#\/agents\/connect$/);
    expect(screen.queryByLabelText('agentsConnectNameLabel')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows OAuth and static connections from the personal list beside company agents', async () => {
    personal.fetchMcpPersonalAgents.mockResolvedValue([
      personalRow(),
      personalRow({
        id: 'static-1',
        kind: 'personal',
        name: 'Static laptop',
        services_allowed: ['identity'],
        oauth_client_id: null,
        personal_token_id: 'pt-1',
        created_at: '2026-05-01T00:00:00Z',
      }),
    ]);
    renderAgentsPage();
    expect(await screen.findByText('Cursor laptop')).toBeTruthy();
    expect(screen.getByText('Static laptop')).toBeTruthy();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(screen.getAllByText('agentsKindOauth')).toHaveLength(1);
    expect(screen.getByText('agentsKindServices:identity, storage')).toBeTruthy();
    expect(screen.getByText('agentsKindPersonal')).toBeTruthy();
    expect(screen.getByText('agentsScopeRegional')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'agentsRevoke' }).length).toBeGreaterThan(1);
  });

  it('labels company-list kinds when the personal list is empty', async () => {
    vi.mocked(fetchCompanyMcpAgents).mockResolvedValueOnce([
      {
        id: 'co-oauth',
        name: 'Company OAuth',
        kind: 'oauth',
        access_mode: 'ask',
        read_level: 'safe',
        allow_destructive_without_asking: false,
        services_allowed: ['email'],
        project_scope: '',
        expires_at: '2026-12-01T00:00:00Z',
        paused_at: null,
        revoked_at: null,
        is_active: true,
        created_at: '2026-06-02T00:00:00Z',
      },
      {
        id: 'co-static',
        name: 'Company static',
        kind: 'personal',
        access_mode: 'ask',
        read_level: 'safe',
        allow_destructive_without_asking: false,
        services_allowed: ['identity', 'saas'],
        project_scope: '',
        expires_at: null,
        paused_at: null,
        revoked_at: null,
        is_active: true,
        created_at: '2026-06-01T00:00:00Z',
      },
    ]);
    renderAgentsPage();
    expect(await screen.findByText('Company OAuth')).toBeTruthy();
    expect(screen.getByText('agentsKindOauth')).toBeTruthy();
    expect(screen.getByText('agentsKindServices:email')).toBeTruthy();
    expect(screen.getByText('Company static')).toBeTruthy();
    expect(screen.getByText('agentsKindPersonal')).toBeTruthy();
    expect(screen.getByText('agentsScopeRegionalSaas')).toBeTruthy();
  });

  it('reloads on tab visibility, window focus, and the drawer broadcast', async () => {
    personal.fetchMcpPersonalAgents.mockResolvedValueOnce([]).mockResolvedValue([personalRow()]);
    renderAgentsPage();
    await screen.findByText('<img src=x onerror=alert(1)>');
    expect(screen.queryByText('Cursor laptop')).toBeNull();

    const hiddenCalls = personal.fetchMcpPersonalAgents.mock.calls.length;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    fireEvent(document, new Event('visibilitychange'));
    await Promise.resolve();
    expect(personal.fetchMcpPersonalAgents.mock.calls.length).toBe(hiddenCalls);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    fireEvent(document, new Event('visibilitychange'));
    expect(await screen.findByText('Cursor laptop')).toBeTruthy();
    expect(screen.getByText('agentsKindOauth')).toBeTruthy();

    personal.fetchMcpPersonalAgents.mockResolvedValue([
      personalRow({
        id: 'static-2',
        kind: 'personal',
        name: 'Static laptop',
        services_allowed: ['identity'],
        oauth_client_id: null,
        personal_token_id: 'pt-2',
      }),
    ]);
    fireEvent(window, new Event('focus'));
    expect(await screen.findByText('Static laptop')).toBeTruthy();
    expect(screen.getByText('agentsKindPersonal')).toBeTruthy();

    const beforeBroadcast = vi.mocked(fetchCompanyMcpAgents).mock.calls.length;
    notifyAgentsChanged();
    await waitFor(() =>
      expect(vi.mocked(fetchCompanyMcpAgents).mock.calls.length).toBeGreaterThan(beforeBroadcast),
    );
  });

  it('revokes an OAuth connection through the personal agents endpoint', async () => {
    personal.fetchMcpPersonalAgents.mockResolvedValue([personalRow()]);
    personal.revokeMcpPersonalAgent.mockResolvedValue(
      personalRow({
        revoked_at: '2026-11-09T00:00:00Z',
        is_active: false,
      }),
    );
    Object.assign(shellui, {
      dialog: (options: { onOk?: () => void }) => {
        options.onOk?.();
      },
    });
    renderAgentsPage();
    const name = await screen.findByText('Cursor laptop');
    const card = name.closest('.overflow-hidden');
    expect(card).toBeTruthy();
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'agentsRevoke' }));
    await waitFor(() =>
      expect(personal.revokeMcpPersonalAgent).toHaveBeenCalledWith('tok', 1, 'oauth-1'),
    );
    await waitFor(() => expect(screen.queryByText('Cursor laptop')).toBeNull());
  });

  it('still lists personal OAuth rows when the company agents API is unavailable', async () => {
    vi.mocked(fetchCompanyMcpAgents).mockRejectedValueOnce(new Error(MCP_API_UNAVAILABLE));
    personal.fetchMcpPersonalAgents.mockResolvedValue([personalRow()]);
    renderAgentsPage();
    expect(await screen.findByText('Cursor laptop')).toBeTruthy();
    expect(screen.getByText('agentsKindOauth')).toBeTruthy();
    expect(screen.queryByText('agentsMcpUnavailableTitle')).toBeNull();
  });
});
