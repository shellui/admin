import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectAgentPage } from '@/features/agents/pages/ConnectAgentPage';
import { MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS } from '@/lib/mcpAgentsConnect';

const { createMcpPersonalAgent, notifyAgentsChanged } = vi.hoisted(() => ({
  createMcpPersonalAgent: vi.fn(),
  notifyAgentsChanged: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts.days === 'number') return `${key}:${opts.days}`;
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

vi.mock('@/lib/personalAgentsApi', () => ({
  fetchMcpPersonalStatus: vi.fn().mockResolvedValue({
    mcp_enabled: true,
    mcp_url: 'https://ai.example.com/c/1/mcp',
    global_identity: false,
  }),
  createMcpPersonalAgent,
}));

vi.mock('@/lib/agentConnectDrawer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agentConnectDrawer')>();
  return { ...actual, notifyAgentsChanged };
});

describe('ConnectAgentPage', () => {
  beforeEach(() => {
    createMcpPersonalAgent.mockReset();
    notifyAgentsChanged.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the lifetime and sends an expiry inside the 90-day cap', async () => {
    createMcpPersonalAgent.mockResolvedValue({
      access_token: 'tok_abc',
      token_type: 'bearer',
      expires_at: '2026-12-01T00:00:00.000Z',
      resource: 'https://ai.example.com/c/1/mcp',
    });
    render(<ConnectAgentPage />);
    expect(
      await screen.findByText(`agentsConnectExpiry:${MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS}`),
    ).toBeTruthy();

    const before = Date.now();
    fireEvent.click(screen.getByRole('button', { name: 'agentsConnectCreateButton' }));
    await waitFor(() => expect(createMcpPersonalAgent).toHaveBeenCalled());

    const input = createMcpPersonalAgent.mock.calls[0][2] as {
      expires_at: string;
      services: string[];
    };
    const expiresMs = Date.parse(input.expires_at);
    expect(expiresMs).toBeLessThan(before + MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS * 86_400_000);
    expect(expiresMs).toBeGreaterThan(before + 89 * 86_400_000);
    expect(input.services).not.toContain('saas');
    expect(await screen.findByText('agentsConnectCreatedTitle')).toBeTruthy();
    expect(notifyAgentsChanged).toHaveBeenCalledTimes(1);
  });

  it('shows a clear message when Identity rejects the expiry', async () => {
    createMcpPersonalAgent.mockRejectedValue(
      new Error('expires_at exceeds the maximum allowed lifetime.'),
    );
    render(<ConnectAgentPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'agentsConnectCreateButton' }));
    expect(await screen.findByText('agentsConnectExpiryTooLong')).toBeTruthy();
    expect(notifyAgentsChanged).not.toHaveBeenCalled();
  });
});
