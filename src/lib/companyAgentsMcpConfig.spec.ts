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
    expect(aiServiceMcpEndpointUrl(origin)).toBe('https://ai.example.com/mcp');
    expect(aiServiceMcpEndpointUrl(`${origin}/`)).toBe('https://ai.example.com/mcp');
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
