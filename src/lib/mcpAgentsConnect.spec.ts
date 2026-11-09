import { describe, expect, it } from 'vitest';
import {
  MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS,
  buildAgentPrompt,
  buildCompanyMcpUrl,
  defaultPersonalAgentExpiresAt,
  formatDefaultAgentName,
  getDefaultPersonalAgentServices,
  isGlobalIdentitySession,
  personalAgentCreateErrorMessage,
} from '@/lib/mcpAgentsConnect';

describe('mcpAgentsConnect', () => {
  it('builds company MCP URL from ai-service origin', () => {
    expect(buildCompanyMcpUrl('https://ai.example.com', 7)).toBe('https://ai.example.com/c/7/mcp');
  });

  it('includes saas only for global identity sessions', () => {
    expect(getDefaultPersonalAgentServices(false)).not.toContain('saas');
    expect(getDefaultPersonalAgentServices(true)).toContain('saas');
    expect(
      isGlobalIdentitySession({ mcp_enabled: true, mcp_url: null, global_identity: true }),
    ).toBe(true);
  });

  it('builds agent prompt with URL and token', () => {
    const prompt = buildAgentPrompt('https://ai.example.com/c/1/mcp', 'tok_abc');
    expect(prompt).toContain('MCP URL: https://ai.example.com/c/1/mcp');
    expect(prompt).toContain('Access token: tok_abc');
  });

  it('formats default agent name', () => {
    expect(formatDefaultAgentName('en', new Date('2026-11-05T12:00:00Z'))).toMatch(/^Agent · /);
  });
});

describe('defaultPersonalAgentExpiresAt', () => {
  it('stays inside Identity default maximum of 90 days', () => {
    const fromMs = Date.parse('2026-11-09T17:05:00.000Z');
    const expiresMs = Date.parse(defaultPersonalAgentExpiresAt(fromMs));
    const maxMs = fromMs + MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS * 86_400_000;
    expect(expiresMs).toBeLessThan(maxMs);
    expect(maxMs - expiresMs).toBe(60_000);
    expect(expiresMs - fromMs).toBeLessThan(365 * 86_400_000);
  });
});

describe('personalAgentCreateErrorMessage', () => {
  it('replaces Identity lifetime rejections with the lifetime message', () => {
    expect(
      personalAgentCreateErrorMessage(
        new Error('expires_at exceeds the maximum allowed lifetime.'),
        {
          expiryTooLong: 'too long',
          fallback: 'generic',
        },
      ),
    ).toBe('too long');
  });

  it('keeps other errors and falls back when the error has no message', () => {
    expect(
      personalAgentCreateErrorMessage(new Error('MCP is not enabled.'), {
        expiryTooLong: 'too long',
        fallback: 'generic',
      }),
    ).toBe('MCP is not enabled.');
    expect(
      personalAgentCreateErrorMessage('nope', { expiryTooLong: 'too long', fallback: 'generic' }),
    ).toBe('generic');
  });
});
