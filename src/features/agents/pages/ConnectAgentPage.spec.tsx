import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { ConnectAgentPage } from '@/features/agents/pages/ConnectAgentPage';
import {
  AGENT_CONNECT_STEPS,
  MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS,
  agentPromptContainsCredentialMaterial,
  buildAgentPrompt,
} from '@/lib/mcpAgentsConnect';

const MCP_URL = 'https://ai.example.com/c/1/mcp';

const { createMcpPersonalAgent, notifyAgentsChanged, writeText } = vi.hoisted(() => ({
  createMcpPersonalAgent: vi.fn(),
  notifyAgentsChanged: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'session-token',
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

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ConnectAgentPage />
    </I18nextProvider>,
  );
}

function promptText(): string {
  const prompt = [...document.querySelectorAll('pre')].find((node) => !node.closest('details'));
  return prompt?.textContent ?? '';
}

describe('ConnectAgentPage', () => {
  beforeEach(async () => {
    createMcpPersonalAgent.mockReset();
    notifyAgentsChanged.mockReset();
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  it('shows the company MCP URL, the OAuth prompt, and the three steps', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Connect an agent' })).toBeTruthy();
    expect(screen.getByText(MCP_URL)).toBeTruthy();
    expect(promptText()).toBe(buildAgentPrompt(MCP_URL, 'en'));
    expect(promptText()).not.toContain('session-token');
    expect(agentPromptContainsCredentialMaterial(promptText().replace(MCP_URL, ''))).toBe(false);
    expect(screen.getByText('What you do:')).toBeTruthy();
    for (const step of AGENT_CONNECT_STEPS.en) {
      expect(screen.getByText(step)).toBeTruthy();
    }
    const details = document.querySelector('details');
    expect(details).toBeTruthy();
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain('Clients that only accept a static secret');
    expect(document.body.textContent).not.toContain('session-token');
  });

  it('copies the prompt and the URL without a secret', async () => {
    renderPage();
    await screen.findByText(MCP_URL);
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(buildAgentPrompt(MCP_URL, 'en')));
    fireEvent.click(screen.getByRole('button', { name: 'Copy URL' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(MCP_URL));
  });

  it('shows the French prompt and steps', async () => {
    await i18n.changeLanguage('fr');
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Connecter un agent' })).toBeTruthy();
    expect(promptText()).toBe(buildAgentPrompt(MCP_URL, 'fr'));
    expect(screen.getByText('Ce que vous faites :')).toBeTruthy();
    for (const step of AGENT_CONNECT_STEPS.fr) {
      expect(screen.getByText(step)).toBeTruthy();
    }
    expect(agentPromptContainsCredentialMaterial(promptText().replace(MCP_URL, ''))).toBe(false);
  });

  it('keeps the secret out of the prompt and inside the 90-day cap', async () => {
    createMcpPersonalAgent.mockResolvedValue({
      access_token: 'static-secret-value',
      token_type: 'bearer',
      expires_at: '2026-12-01T00:00:00.000Z',
      resource: MCP_URL,
    });
    renderPage();
    expect(await screen.findByText(MCP_URL)).toBeTruthy();
    expect(document.body.textContent).not.toContain('static-secret-value');
    expect(document.body.textContent).toContain(
      `This connection expires in ${MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS} days.`,
    );

    const before = Date.now();
    fireEvent.click(screen.getByRole('button', { name: 'Create secret', hidden: true }));
    await waitFor(() => expect(createMcpPersonalAgent).toHaveBeenCalled());

    const input = createMcpPersonalAgent.mock.calls[0][2] as {
      expires_at: string;
      services: string[];
    };
    const expiresMs = Date.parse(input.expires_at);
    expect(expiresMs).toBeLessThan(before + MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS * 86_400_000);
    expect(expiresMs).toBeGreaterThan(before + 89 * 86_400_000);
    expect(input.services).not.toContain('saas');
    expect(notifyAgentsChanged).toHaveBeenCalledTimes(1);

    expect(await screen.findByText('static-secret-value')).toBeTruthy();
    expect(document.body.textContent).toContain(
      'Copy this secret now. Shellui shows it only once. The prompt above does not include it.',
    );
    expect(promptText()).toBe(buildAgentPrompt(MCP_URL, 'en'));
    expect(promptText()).not.toContain('static-secret-value');
    expect(document.querySelector('details')?.open).toBe(true);
    expect(agentPromptContainsCredentialMaterial(promptText().replace(MCP_URL, ''))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Hide secret' }));
    await waitFor(() => expect(document.body.textContent).not.toContain('static-secret-value'));
    expect(promptText()).toBe(buildAgentPrompt(MCP_URL, 'en'));
  });

  it('shows a clear message when Identity rejects the expiry', async () => {
    createMcpPersonalAgent.mockRejectedValue(
      new Error('expires_at exceeds the maximum allowed lifetime.'),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create secret', hidden: true }));
    expect(
      await screen.findByText(
        'Identity rejected this expiry. It is longer than the maximum lifetime for this connection.',
      ),
    ).toBeTruthy();
    expect(notifyAgentsChanged).not.toHaveBeenCalled();
    expect(promptText()).not.toContain('exceeds the maximum');
  });
});
