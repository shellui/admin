import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import shellui from '@shellui/sdk';
import { notifyAgentsChanged } from '@/lib/agentConnectDrawer';
import {
  fetchCompanyMcpAgents,
  fetchCompanyMcpCallLogs,
  MCP_API_UNAVAILABLE,
  type CompanyMcpCallLogEntry,
  type CompanyMcpCallLogsPage,
} from '@/lib/companyAgentsApi';
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
      if (key === 'agentsLogViaWrapper' && typeof opts?.tool === 'string')
        return `via ${opts.tool}`;
      if (key === 'agentsCallLogShown' && typeof opts?.shown === 'number') {
        return `${opts.shown} of ${opts.count}`;
      }
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
  fetchMcpPersonalAgentCallLogs: vi.fn(),
  fetchMcpPersonalOauthConsent: vi.fn(),
}));

vi.mock('@/lib/personalAgentsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/personalAgentsApi')>();
  return {
    ...actual,
    fetchMcpPersonalAgents: personal.fetchMcpPersonalAgents,
    revokeMcpPersonalAgent: personal.revokeMcpPersonalAgent,
    fetchMcpPersonalAgentCallLogs: personal.fetchMcpPersonalAgentCallLogs,
    fetchMcpPersonalOauthConsent: personal.fetchMcpPersonalOauthConsent,
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
    fetchCompanyMcpCallLogs: vi.fn(),
    fetchMcpDiscoveredServices: vi.fn().mockResolvedValue([]),
  };
});

function callLogRow(overrides: Partial<CompanyMcpCallLogEntry> = {}): CompanyMcpCallLogEntry {
  return {
    id: 1,
    company_id: 1,
    agent_id: 'a1',
    agent_name: '<script>alert(1)</script>',
    client_id: '',
    client_name: '',
    token_kind: 'agent',
    user_id: null,
    user_email: '',
    service: 'identity',
    tool_name: 'list_users',
    wrapper_tool: '',
    arguments: { note: '<b>bold</b>' },
    status: 'allowed',
    status_code: 200,
    error_code: '',
    error_message: '',
    duration_ms: 50,
    approval_id: '',
    approval_channel: 'none',
    approval_outcome: '',
    operation_title: 'list_users',
    access_kind: 'read',
    outcome: 'allowed',
    resource_label: 'list_users',
    created_at: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

function callLogPage(rows: CompanyMcpCallLogEntry[], count = rows.length): CompanyMcpCallLogsPage {
  return { count, limit: 50, offset: 0, call_logs: rows };
}

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
    personal.fetchMcpPersonalAgentCallLogs.mockReset();
    personal.fetchMcpPersonalOauthConsent.mockReset();
    personal.fetchMcpPersonalAgents.mockResolvedValue([]);
    personal.fetchMcpPersonalAgentCallLogs.mockResolvedValue({
      count: 0,
      limit: 50,
      offset: 0,
      call_logs: [],
    });
    personal.fetchMcpPersonalOauthConsent.mockResolvedValue([]);
    vi.mocked(fetchCompanyMcpAgents).mockClear();
    vi.mocked(fetchCompanyMcpCallLogs).mockReset();
    vi.mocked(fetchCompanyMcpCallLogs).mockResolvedValue(callLogPage([callLogRow()]));
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
    const statusBadge = within(table).getByText('agentsLogStatusAllowed');
    expect(statusBadge.className).toContain('bg-emerald-500/10');
    expect(within(table).getByText('identity')).toBeTruthy();
    expect(document.body.textContent).not.toContain('<b>bold</b>');
    expect(vi.mocked(fetchCompanyMcpCallLogs)).toHaveBeenCalledWith(
      'tok',
      1,
      expect.objectContaining({ agent: 'a1', limit: 50, offset: 0 }),
    );
  });

  it('shows the service badge, wrapper, approval, and error message', async () => {
    vi.mocked(fetchCompanyMcpCallLogs).mockResolvedValue(
      callLogPage([
        callLogRow({
          service: 'storage',
          tool_name: 'list_objects',
          wrapper_tool: 'ai_call_tool',
          status: 'failed',
          status_code: 500,
          error_message: 'Storage timed out.',
          approval_channel: 'form',
          approval_outcome: 'approved',
        }),
      ]),
    );
    renderAgentsPage();
    fireEvent.click(await screen.findByRole('button', { name: 'agentsExpandAgent' }));
    const tool = await screen.findByText('list_objects');
    const table = tool.closest('table')!;
    expect(within(table).getByText('storage')).toBeTruthy();
    expect(within(table).getByText('via ai_call_tool')).toBeTruthy();
    expect(within(table).getByText(/agentsLogApprovalChannel_form/)).toBeTruthy();
    expect(within(table).getByText(/approved/)).toBeTruthy();
    expect(within(table).getByText('Storage timed out.')).toBeTruthy();
    expect(within(table).getByText('agentsLogStatusFailed').className).toContain('bg-red-500/10');
  });

  it('loads the next call log page from the current offset', async () => {
    vi.mocked(fetchCompanyMcpCallLogs).mockImplementation(async (_token, _companyId, query) => {
      const offset = query?.offset ?? 0;
      if (offset > 0) {
        return {
          count: 2,
          limit: 50,
          offset,
          call_logs: [callLogRow({ id: 2, tool_name: 'delete_object', status: 'denied' })],
        };
      }
      return callLogPage([callLogRow()], 2);
    });
    renderAgentsPage();
    fireEvent.click(await screen.findByRole('button', { name: 'agentsExpandAgent' }));
    expect(await screen.findByText('1 of 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'agentsCallLogLoadMore' }));
    expect(await screen.findByText('delete_object')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();
    const offsets = vi.mocked(fetchCompanyMcpCallLogs).mock.calls.map((call) => call[2]?.offset);
    expect(offsets).toContain(0);
    expect(offsets).toContain(1);
  });

  it('shows a call log error and can try again', async () => {
    vi.mocked(fetchCompanyMcpCallLogs)
      .mockRejectedValueOnce(new Error('Call logs are not available from ai-service.'))
      .mockResolvedValueOnce(callLogPage([]));
    renderAgentsPage();
    fireEvent.click(await screen.findByRole('button', { name: 'agentsExpandAgent' }));
    expect(await screen.findByText('Call logs are not available from ai-service.')).toBeTruthy();
    expect(screen.queryByText('agentsCallLogEmptyRange')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'agentsCallLogRetry' }));
    expect(await screen.findByText('agentsCallLogEmptyRange')).toBeTruthy();
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

  it('loads a personal agent from ai-service call logs and identity OAuth consent', async () => {
    personal.fetchMcpPersonalAgents.mockResolvedValue([personalRow()]);
    personal.fetchMcpPersonalAgentCallLogs.mockResolvedValue({
      count: 2,
      limit: 50,
      offset: 0,
      call_logs: [
        callLogRow({
          id: 9,
          agent_id: 'oauth-1',
          service: 'storage',
          tool_name: 'storage_list_buckets',
          wrapper_tool: 'ai_call_tool',
          status: 'failed',
          error_message: 'Storage timed out.',
          approval_channel: 'form',
          approval_outcome: 'approved',
        }),
      ],
    });
    personal.fetchMcpPersonalOauthConsent.mockResolvedValue([
      {
        timestamp: '2026-11-01T00:00:00Z',
        tool: 'oauth.device.approved',
        service: 'identity',
        operationTitle: 'oauth.device.approved',
        outcome: 'allowed',
        durationMs: null,
      },
    ]);
    renderAgentsPage();
    const name = await screen.findByText('Cursor laptop');
    const card = name.closest('.overflow-hidden') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'agentsExpandAgent' }));

    const tool = await screen.findByText('storage_list_buckets');
    const table = tool.closest('table')!;
    expect(within(table).getByText('storage')).toBeTruthy();
    expect(within(table).getByText('via ai_call_tool')).toBeTruthy();
    expect(within(table).getByText(/agentsLogApprovalChannel_form/)).toBeTruthy();
    expect(within(table).getByText(/approved/)).toBeTruthy();
    expect(within(table).getByText('Storage timed out.')).toBeTruthy();
    expect(within(table).getByText('agentsConsentDevice')).toBeTruthy();
    expect(vi.mocked(fetchCompanyMcpCallLogs)).not.toHaveBeenCalled();
    expect(personal.fetchMcpPersonalAgentCallLogs).toHaveBeenCalledWith(
      'tok',
      'oauth-1',
      expect.objectContaining({ limit: 50, offset: 0 }),
    );

    personal.fetchMcpPersonalAgentCallLogs.mockResolvedValueOnce({
      count: 2,
      limit: 50,
      offset: 1,
      call_logs: [callLogRow({ id: 10, agent_id: 'oauth-1', tool_name: 'storage_delete_object' })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'agentsCallLogLoadMore' }));
    expect(await screen.findByText('storage_delete_object')).toBeTruthy();
    expect(personal.fetchMcpPersonalAgentCallLogs).toHaveBeenLastCalledWith(
      'tok',
      'oauth-1',
      expect.objectContaining({ offset: 1 }),
    );
  });

  it('shows an inline message when ai-service is unreachable for a personal agent', async () => {
    personal.fetchMcpPersonalAgents.mockResolvedValue([personalRow()]);
    personal.fetchMcpPersonalAgentCallLogs.mockRejectedValue(new Error('network down'));
    personal.fetchMcpPersonalOauthConsent.mockResolvedValue([
      {
        timestamp: '2026-11-01T00:00:00Z',
        tool: 'oauth.authorize.approved',
        service: 'identity',
        operationTitle: null,
        outcome: 'allowed',
        durationMs: null,
      },
    ]);
    renderAgentsPage();
    const name = await screen.findByText('Cursor laptop');
    fireEvent.click(
      within(name.closest('.overflow-hidden') as HTMLElement).getByRole('button', {
        name: 'agentsExpandAgent',
      }),
    );
    expect(await screen.findByText('agentsPersonalCallsUnavailable')).toBeTruthy();
    expect(screen.getByText('agentsConsentAuthorize')).toBeTruthy();
    expect(vi.mocked(fetchCompanyMcpCallLogs)).not.toHaveBeenCalled();
  });
});
