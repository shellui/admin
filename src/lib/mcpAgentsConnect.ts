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

/**
 * Identity `MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS` default (clamped to 1..366 days).
 * `POST /api/v1/mcp/personal/agents/create` rejects a later `expires_at`.
 * Personal status does not return the live setting, so the client uses this default.
 */
export const MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS = 90;

const DAY_MS = 86_400_000;

/**
 * Stay strictly inside Identity's `expires_at > now + max` check when the browser
 * clock is a little ahead of the server.
 */
const PERSONAL_AGENT_EXPIRY_SKEW_MS = 60_000;

/** Substring Identity returns when `expires_at` is past the maximum lifetime. */
export const PERSONAL_AGENT_EXPIRY_TOO_LONG = 'exceeds the maximum allowed lifetime';

/** Default personal-agent expiry when the UI does not expose a picker. */
export function defaultPersonalAgentExpiresAt(fromMs = Date.now()): string {
  const lifetimeMs = MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS * DAY_MS - PERSONAL_AGENT_EXPIRY_SKEW_MS;
  return new Date(fromMs + lifetimeMs).toISOString();
}

export function personalAgentCreateErrorMessage(
  error: unknown,
  messages: { expiryTooLong: string; fallback: string },
): string {
  const raw = error instanceof Error ? error.message : '';
  if (raw.includes(PERSONAL_AGENT_EXPIRY_TOO_LONG)) return messages.expiryTooLong;
  return raw || messages.fallback;
}
