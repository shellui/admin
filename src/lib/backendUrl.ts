import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';

function normalizeBaseUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().replace(/\/+$/, '');
}

/**
 * Latest non-empty `authBackendBaseUrl` from a `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED` payload.
 * The SDK’s `initialSettings` is only the first snapshot; we keep this in sync when the shell pushes updates.
 */
let authBackendBaseUrlFromShellMessages: string | null = null;

function rememberAuthBackendBaseUrlFromSettings(settings: Settings | null | undefined): void {
  const next = normalizeBaseUrl(settings?.authBackendBaseUrl ?? undefined);
  if (next) {
    authBackendBaseUrlFromShellMessages = next;
  }
}

/** Call after `await shellui.init()` so API modules see the shell `backend.url` before the first fetch. */
export function hydrateAuthBackendBaseUrlFromSdk(): void {
  rememberAuthBackendBaseUrlFromSettings(shellui.initialSettings);
}

if (typeof window !== 'undefined' && window.parent !== window) {
  rememberAuthBackendBaseUrlFromSettings(shellui.initialSettings);
  addMessageListener('SHELLUI_SETTINGS', (message) => {
    rememberAuthBackendBaseUrlFromSettings(
      (message.payload as { settings?: Settings } | undefined)?.settings,
    );
  });
  addMessageListener('SHELLUI_SETTINGS_UPDATED', (message) => {
    rememberAuthBackendBaseUrlFromSettings(
      (message.payload as { settings?: Settings } | undefined)?.settings,
    );
  });
}

/**
 * Resolves the shellui-auth base URL from parent shell `backend.url` (via `authBackendBaseUrl`
 * in SDK settings). Falls back to localhost only when that value is missing (e.g. old shell).
 */
export function getAuthBackendBaseUrl(): string {
  const fromShellMessages = authBackendBaseUrlFromShellMessages;
  const fromInitialSettings = normalizeBaseUrl(shellui.initialSettings?.authBackendBaseUrl);
  return fromShellMessages ?? fromInitialSettings ?? 'http://localhost:8000';
}
