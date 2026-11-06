import { describe, expect, it } from 'vitest';
import {
  buildAgentPrompt,
  buildCompanyMcpUrl,
  formatDefaultAgentName,
  getDefaultPersonalAgentServices,
  isGlobalIdentitySession,
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
