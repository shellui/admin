import { aiServiceMcpEndpointUrl } from '@/lib/companyAgentsMcpConfig';
import type { McpPersonalService, McpPersonalStatus } from '@/lib/personalAgentsApi';

/** Regional services selectable for personal agent tokens (`ai` is added server-side). */
export const MCP_REGIONAL_PERSONAL_SERVICES: Exclude<McpPersonalService, 'saas'>[] = [
  'identity',
  'storage',
  'hosting',
  'email',
];

export function buildCompanyMcpUrl(
  aiServiceUrl: string | null | undefined,
  companyId: number | null | undefined,
  fallbackUrl?: string | null,
): string {
  const built = aiServiceMcpEndpointUrl(aiServiceUrl?.trim().replace(/\/+$/, '') ?? '', companyId);
  if (built) return built;
  const fallback = fallbackUrl?.trim();
  return fallback || '';
}

export function isGlobalIdentitySession(status: McpPersonalStatus | null): boolean {
  return status?.global_identity === true;
}

export function getDefaultPersonalAgentServices(includeSaas: boolean): McpPersonalService[] {
  const services: McpPersonalService[] = [...MCP_REGIONAL_PERSONAL_SERVICES];
  if (includeSaas) {
    services.push('saas');
  }
  return services;
}

export function buildAgentPrompt(mcpUrl: string, accessToken: string): string {
  return [
    'Connect to this Shellui company over MCP.',
    '',
    `MCP URL: ${mcpUrl}`,
    `Access token: ${accessToken}`,
    '',
    "Use the URL as the MCP server endpoint and send the token as the bearer credential. Prefer the company's configured OAuth flow when the client supports it; use this token when the client needs a static secret.",
  ].join('\n');
}

export function formatDefaultAgentName(locale: string, at: Date = new Date()): string {
  let dateLabel: string;
  try {
    dateLabel = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(at);
  } catch {
    dateLabel = at.toISOString().slice(0, 10);
  }
  return `Agent · ${dateLabel}`;
}

/** Default personal-agent expiry when the UI does not expose a picker (one year). */
export function defaultPersonalAgentExpiresAt(fromMs = Date.now()): string {
  return new Date(fromMs + 365 * 86400000).toISOString();
}
