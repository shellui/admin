import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';
import { readDevServiceUrlFromEnv } from '@/lib/devServiceUrl';
import { normalizeServiceOrigin } from '@/lib/emailServiceUrl';

/** ai-service connection from host `aiService` in shellui.config.json. */
export interface SettingsAiService {
  /** Base URL of ai-service (no trailing slash). */
  url: string;
}

export type SettingsWithAiService = Settings & {
  aiService?: SettingsAiService | null;
};

/** ai-service origin without trailing slash, or `null` when none is configured. */
export function resolveAiServiceUrl(raw: string | null | undefined): string | null {
  return normalizeServiceOrigin(raw);
}

/** `settings.aiService` with a usable URL, or `null`. */
export function readSettingsAiService(
  settings: Settings | null | undefined,
): SettingsAiService | null {
  const aiService = (settings as SettingsWithAiService | null | undefined)?.aiService;
  const url = resolveAiServiceUrl(aiService?.url);
  if (!url) return null;
  return { url };
}

let aiServiceUrlFromShellMessages: string | null = null;

function rememberAiServiceUrlFromSettings(settings: Settings | null | undefined): void {
  const next = readSettingsAiService(settings)?.url ?? null;
  if (next) {
    aiServiceUrlFromShellMessages = next;
  }
}

/** Explicit ai-service URL from this frame's shell settings, with no Vite fallback. */
export function readExplicitAiServiceUrl(): string | null {
  return (
    aiServiceUrlFromShellMessages ?? readSettingsAiService(shellui.initialSettings)?.url ?? null
  );
}

/**
 * ai-service origin for MCP client connect copy.
 * Uses `settings.aiService.url` from the host shell, or `VITE_AI_SERVICE_URL` in dev builds.
 */
export function getAiServiceBaseUrl(): string | null {
  const fromShell = readExplicitAiServiceUrl();
  if (fromShell) return fromShell;
  const fromEnv = readDevServiceUrlFromEnv(import.meta.env.VITE_AI_SERVICE_URL);
  if (fromEnv) return fromEnv;
  return null;
}

export class AiServiceNotConfiguredError extends Error {
  constructor() {
    super(
      'ai-service URL is not configured. Set aiService.url in the host shell config (shellui.config.json or shellui.config.ts).',
    );
    this.name = 'AiServiceNotConfiguredError';
  }
}

export function requireAiServiceBaseUrl(): string {
  const url = getAiServiceBaseUrl();
  if (!url) throw new AiServiceNotConfiguredError();
  return url;
}

export function hydrateAiServiceUrlFromSdk(): void {
  rememberAiServiceUrlFromSettings(shellui.initialSettings);
}

if (typeof window !== 'undefined' && window.parent !== window) {
  rememberAiServiceUrlFromSettings(shellui.initialSettings);
  addMessageListener('SHELLUI_SETTINGS', (message) => {
    rememberAiServiceUrlFromSettings(
      (message.payload as { settings?: Settings } | undefined)?.settings,
    );
  });
  addMessageListener('SHELLUI_SETTINGS_UPDATED', (message) => {
    rememberAiServiceUrlFromSettings(
      (message.payload as { settings?: Settings } | undefined)?.settings,
    );
  });
}
