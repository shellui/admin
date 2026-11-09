import { aiServiceMcpEndpointUrl } from '@/lib/companyAgentsMcpConfig';
import type { CompanyMcpAgent } from '@/lib/companyAgentsTypes';
import type {
  McpPersonalAgent,
  McpPersonalService,
  McpPersonalStatus,
} from '@/lib/personalAgentsApi';

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

export function isAbsoluteHttpUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Locales for the copy-paste "Connect an agent" prompt.
 * The prompt names the company MCP URL and OAuth (device login for a headless
 * client or a CLI). It must never include an access token, refresh token,
 * device code, or user code.
 */
export const AGENT_CONNECT_PROMPT_LOCALES = ['en', 'fr'] as const;

export type AgentConnectPromptLocale = (typeof AGENT_CONNECT_PROMPT_LOCALES)[number];

export function resolveAgentConnectPromptLocale(
  language: string | null | undefined,
): AgentConnectPromptLocale {
  const base = language?.toLowerCase().split('-')[0];
  return base === 'fr' ? 'fr' : 'en';
}

/** Exact steps shown under the prompt. Keep in sync with i18n. */
export const AGENT_CONNECT_STEPS: Record<
  AgentConnectPromptLocale,
  readonly [string, string, string]
> = {
  en: [
    'Paste the prompt into your agent.',
    'Open the link it shows.',
    'Check the code and choose Allow.',
  ],
  fr: [
    "Collez l'invite dans votre agent.",
    "Ouvrez le lien qu'il affiche.",
    'Vérifiez le code, puis choisissez Autoriser.',
  ],
};

function englishAgentPrompt(mcpUrl: string): string {
  return [
    'Connect to this Shellui company over MCP.',
    '',
    `MCP URL: ${mcpUrl}`,
    '',
    'Add this URL as a remote MCP server and sign in with OAuth.',
    'If this client is headless or a CLI, use device login.',
    'Show the link and the code, then wait until I approve them.',
  ].join('\n');
}

function frenchAgentPrompt(mcpUrl: string): string {
  return [
    'Connectez cette entreprise Shellui en MCP.',
    '',
    `URL MCP : ${mcpUrl}`,
    '',
    'Ajoutez cette URL comme serveur MCP distant et connectez-vous avec OAuth.',
    'Si le client est sans interface ou en ligne de commande, utilisez device login.',
    'Montrez le lien et le code, puis attendez que je les approuve.',
  ].join('\n');
}

/**
 * Copy-paste prompt for an agent. `locale` selects English or French.
 * Any other value falls back to English and is not interpolated.
 */
export function buildAgentPrompt(mcpUrl: string, locale: AgentConnectPromptLocale = 'en'): string {
  const url = mcpUrl.trim();
  if (!isAbsoluteHttpUrl(url)) {
    throw new Error('Company MCP URL must be an absolute http(s) URL.');
  }
  return locale === 'fr' ? frenchAgentPrompt(url) : englishAgentPrompt(url);
}

const CREDENTIAL_MARKERS = [
  'token',
  'bearer',
  'secret',
  'password',
  'device_code',
  'user_code',
  'authorization',
  'eyj',
];

/** True when copy-paste text contains credential-shaped words. */
export function agentPromptContainsCredentialMaterial(prompt: string): boolean {
  const haystack = prompt.toLowerCase();
  return CREDENTIAL_MARKERS.some((marker) => haystack.includes(marker));
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

export function formatDefaultAgentName(locale: string, at: Date = new Date()): string {
  let dateLabel: string;
  try {
    dateLabel = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(at);
  } catch {
    dateLabel = at.toISOString().slice(0, 10);
  }
  return `Agent · ${dateLabel}`;
}

export function agentIncludesSaasScope(agent: { services_allowed?: string[] | null }): boolean {
  return (agent.services_allowed ?? []).some((service) => service.toLowerCase() === 'saas');
}

export function personalAgentAsCompanyAgent(agent: McpPersonalAgent): CompanyMcpAgent {
  return {
    id: agent.id,
    name: agent.name,
    kind: agent.kind,
    access_mode: agent.access_mode,
    read_level: agent.read_level,
    allow_destructive_without_asking: agent.allow_destructive_without_asking,
    services_allowed: agent.services_allowed,
    project_scope: '',
    expires_at: agent.expires_at,
    paused_at: agent.paused_at,
    revoked_at: agent.revoked_at,
    is_active: agent.is_active,
    created_at: agent.created_at,
    created_by: null,
    call_count: null,
  };
}

/**
 * Company admin lists agents from `GET /api/v1/mcp/agents`.
 * OAuth device-login rows come from `GET /api/v1/mcp/personal/agents` (`kind: "oauth"`).
 * Overlay that kind onto matching company rows, and keep personal rows the company
 * list does not return yet.
 */
export function mergeCompanyAndPersonalAgents(
  company: CompanyMcpAgent[],
  personal: McpPersonalAgent[],
): { agents: CompanyMcpAgent[]; personalIds: Set<string> } {
  const personalById = new Map(personal.map((row) => [row.id, row]));
  const personalIds = new Set(personalById.keys());
  const seen = new Set<string>();
  const agents: CompanyMcpAgent[] = [];

  for (const row of company) {
    seen.add(row.id);
    const owned = personalById.get(row.id);
    if (!owned) {
      agents.push(row);
      continue;
    }
    agents.push({
      ...row,
      kind: owned.kind,
      services_allowed: owned.services_allowed.length
        ? owned.services_allowed
        : row.services_allowed,
      name: row.name || owned.name,
    });
  }

  for (const owned of personal) {
    if (seen.has(owned.id)) continue;
    agents.push(personalAgentAsCompanyAgent(owned));
  }

  agents.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { agents, personalIds };
}

export function connectionKindLines(
  agent: Pick<CompanyMcpAgent, 'kind' | 'services_allowed'>,
  labels: {
    oauth: string;
    personal: string;
    services: (services: string) => string;
    scopeRegional: string;
    scopeRegionalSaas: string;
  },
): string[] {
  if (agent.kind === 'oauth') {
    const lines = [labels.oauth];
    if (agent.services_allowed.length > 0) {
      lines.push(labels.services(agent.services_allowed.join(', ')));
    }
    return lines;
  }
  if (agent.kind === 'personal') {
    return [
      labels.personal,
      agentIncludesSaasScope(agent) ? labels.scopeRegionalSaas : labels.scopeRegional,
    ];
  }
  return [];
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
