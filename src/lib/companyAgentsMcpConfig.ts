/** Identity docs: `routeBasePath` identity + `docs/mcp-and-agents.md` in identity-service. */
export const IDENTITY_MCP_AGENTS_DOCS_URL = 'https://docs.shellui.com/identity/mcp-and-agents/';

/**
 * Per-company MCP URL on ai-service: `{origin}/c/<company_id>/mcp`.
 * The company comes from the URL, so it is empty until the company id is known.
 */
export function aiServiceMcpEndpointUrl(
  aiServiceOrigin: string,
  companyId: number | null | undefined,
): string {
  const origin = aiServiceOrigin.replace(/\/+$/, '');
  if (!origin || companyId == null || !Number.isInteger(companyId) || companyId < 1) return '';
  return `${origin}/c/${companyId}/mcp`;
}

export function mcpConnectPrompt(mcpUrl: string, companyId: number | null | undefined): string {
  return `Connect to ${aiServiceMcpEndpointUrl(mcpUrl, companyId)} and sign in`;
}

export function claudeDesktopMcpConfig(
  mcpUrl: string,
  companyId: number | null | undefined,
): string {
  return aiServiceMcpEndpointUrl(mcpUrl, companyId);
}

export function cursorMcpConfig(mcpUrl: string, companyId: number | null | undefined): string {
  const url = aiServiceMcpEndpointUrl(mcpUrl, companyId);
  return JSON.stringify(
    {
      mcpServers: {
        shellui: {
          url,
        },
      },
    },
    null,
    2,
  );
}

export function chatGptMcpServerUrl(mcpUrl: string, companyId: number | null | undefined): string {
  return aiServiceMcpEndpointUrl(mcpUrl, companyId);
}

export function genericMcpJsonConfig(mcpUrl: string, companyId: number | null | undefined): string {
  const url = aiServiceMcpEndpointUrl(mcpUrl, companyId);
  return JSON.stringify(
    {
      servers: {
        shellui: {
          type: 'http',
          url,
        },
      },
    },
    null,
    2,
  );
}

export type McpClientId = 'claude' | 'cursor' | 'chatgpt' | 'other';

export function mcpClientCopySnippet(
  client: McpClientId,
  aiServiceOrigin: string,
  companyId: number | null | undefined,
): string {
  switch (client) {
    case 'claude':
      return claudeDesktopMcpConfig(aiServiceOrigin, companyId);
    case 'cursor':
      return cursorMcpConfig(aiServiceOrigin, companyId);
    case 'chatgpt':
      return chatGptMcpServerUrl(aiServiceOrigin, companyId);
    case 'other':
      return genericMcpJsonConfig(aiServiceOrigin, companyId);
  }
}
