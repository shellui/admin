/** Identity docs: `routeBasePath` identity + `docs/mcp-and-agents.md` in identity-service. */
export const IDENTITY_MCP_AGENTS_DOCS_URL = 'https://docs.shellui.com/identity/mcp-and-agents/';

export function identityMcpEndpointUrl(mcpOrigin: string): string {
  return `${mcpOrigin.replace(/\/+$/, '')}/mcp`;
}

export function mcpConnectPrompt(mcpUrl: string): string {
  return `Connect to ${identityMcpEndpointUrl(mcpUrl)} and sign in`;
}

export function claudeDesktopMcpConfig(mcpUrl: string): string {
  return identityMcpEndpointUrl(mcpUrl);
}

export function cursorMcpConfig(mcpUrl: string): string {
  const url = identityMcpEndpointUrl(mcpUrl);
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

export function chatGptMcpServerUrl(mcpUrl: string): string {
  return identityMcpEndpointUrl(mcpUrl);
}

export function genericMcpJsonConfig(mcpUrl: string): string {
  const url = identityMcpEndpointUrl(mcpUrl);
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

export function mcpClientCopySnippet(client: McpClientId, mcpOrigin: string): string {
  switch (client) {
    case 'claude':
      return claudeDesktopMcpConfig(mcpOrigin);
    case 'cursor':
      return cursorMcpConfig(mcpOrigin);
    case 'chatgpt':
      return chatGptMcpServerUrl(mcpOrigin);
    case 'other':
      return genericMcpJsonConfig(mcpOrigin);
  }
}
