import { describe, expect, it } from 'vitest';
import {
  aiServiceMcpEndpointUrl,
  chatGptMcpServerUrl,
  claudeDesktopMcpConfig,
  cursorMcpConfig,
  genericMcpJsonConfig,
  IDENTITY_MCP_AGENTS_DOCS_URL,
  mcpClientCopySnippet,
  mcpConnectPrompt,
} from '@/lib/companyAgentsMcpConfig';

describe('companyAgentsMcpConfig', () => {
  const origin = 'https://ai.example.com';

  it('builds ai-service MCP endpoint URL', () => {
    expect(aiServiceMcpEndpointUrl(origin, 42)).toBe('https://ai.example.com/c/42/mcp');
    expect(aiServiceMcpEndpointUrl(`${origin}/`, 42)).toBe('https://ai.example.com/c/42/mcp');
  });

  it('has no URL until the company is known', () => {
    expect(aiServiceMcpEndpointUrl(origin, null)).toBe('');
    expect(aiServiceMcpEndpointUrl(origin, 0)).toBe('');
    expect(aiServiceMcpEndpointUrl(origin, 1.5)).toBe('');
  });

  it('points docs link at identity service path', () => {
    expect(IDENTITY_MCP_AGENTS_DOCS_URL).toBe('https://docs.shellui.com/identity/mcp-and-agents/');
  });

  it('MCP copy helpers never embed bearer tokens', () => {
    for (const blob of [
      mcpConnectPrompt(origin, 42),
      claudeDesktopMcpConfig(origin, 42),
      cursorMcpConfig(origin, 42),
      chatGptMcpServerUrl(origin, 42),
      genericMcpJsonConfig(origin, 42),
      ...(['claude', 'cursor', 'chatgpt', 'other'] as const).map((c) =>
        mcpClientCopySnippet(c, origin, 42),
      ),
    ]) {
      expect(blob.toLowerCase()).not.toMatch(/bearer|refresh_token|access_token|secret/);
      expect(blob).toContain(`${origin}/c/42/mcp`);
    }
  });
});
