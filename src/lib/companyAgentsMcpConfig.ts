/** Identity docs: `routeBasePath` identity + `docs/mcp-and-agents.md` in identity-service. */
export const IDENTITY_MCP_AGENTS_DOCS_URL = 'https://docs.shellui.com/identity/mcp-and-agents/';

export function aiServiceMcpEndpointUrl(aiServiceOrigin: string): string {
  return `${aiServiceOrigin.replace(/\/+$/, '')}/mcp`;
}

export function mcpConnectPrompt(mcpUrl: string): string {
  return `Connect to ${aiServiceMcpEndpointUrl(mcpUrl)} and sign in`;
}

export function claudeDesktopMcpConfig(mcpUrl: string): string {
  return aiServiceMcpEndpointUrl(mcpUrl);
}

export function cursorMcpConfig(mcpUrl: string): string {
  const url = aiServiceMcpEndpointUrl(mcpUrl);
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
  return aiServiceMcpEndpointUrl(mcpUrl);
}

export function genericMcpJsonConfig(mcpUrl: string): string {
  const url = aiServiceMcpEndpointUrl(mcpUrl);
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

export function mcpClientCopySnippet(client: McpClientId, aiServiceOrigin: string): string {
  switch (client) {
    case 'claude':
      return claudeDesktopMcpConfig(aiServiceOrigin);
    case 'cursor':
      return cursorMcpConfig(aiServiceOrigin);
    case 'chatgpt':
      return chatGptMcpServerUrl(aiServiceOrigin);
    case 'other':
      return genericMcpJsonConfig(aiServiceOrigin);
  }
}
