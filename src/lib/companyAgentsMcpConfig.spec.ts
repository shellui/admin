import { describe, expect, it } from 'vitest';
import {
  chatGptMcpServerUrl,
  claudeDesktopMcpConfig,
  cursorMcpConfig,
  genericMcpJsonConfig,
  IDENTITY_MCP_AGENTS_DOCS_URL,
  identityMcpEndpointUrl,
  mcpClientCopySnippet,
  mcpConnectPrompt,
} from '@/lib/companyAgentsMcpConfig';

describe('companyAgentsMcpConfig', () => {
  const origin = 'https://auth.example.com';

  it('builds identity MCP endpoint URL', () => {
    expect(identityMcpEndpointUrl(origin)).toBe('https://auth.example.com/mcp');
    expect(identityMcpEndpointUrl(`${origin}/`)).toBe('https://auth.example.com/mcp');
  });

  it('points docs link at identity service path', () => {
    expect(IDENTITY_MCP_AGENTS_DOCS_URL).toBe('https://docs.shellui.com/identity/mcp-and-agents/');
  });

  it('MCP copy helpers never embed bearer tokens', () => {
    for (const blob of [
      mcpConnectPrompt(origin),
      claudeDesktopMcpConfig(origin),
      cursorMcpConfig(origin),
      chatGptMcpServerUrl(origin),
      genericMcpJsonConfig(origin),
      ...(['claude', 'cursor', 'chatgpt', 'other'] as const).map((c) =>
        mcpClientCopySnippet(c, origin),
      ),
    ]) {
      expect(blob.toLowerCase()).not.toMatch(/bearer|refresh_token|access_token|secret/);
      expect(blob).toContain(`${origin}/mcp`);
    }
  });
});
