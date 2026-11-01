export function mcpConnectPrompt(mcpUrl: string): string {
  const base = mcpUrl.replace(/\/+$/, '');
  return `Connect to ${base}/mcp and sign in`;
}

export function claudeDesktopMcpConfig(mcpUrl: string): string {
  const url = `${mcpUrl.replace(/\/+$/, '')}/mcp`;
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

export function cursorMcpConfig(mcpUrl: string): string {
  const url = `${mcpUrl.replace(/\/+$/, '')}/mcp`;
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

export function genericMcpJsonConfig(mcpUrl: string): string {
  const url = `${mcpUrl.replace(/\/+$/, '')}/mcp`;
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
