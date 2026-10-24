import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';

/** Local identity-service origin used only by the dev server. */
export const DEV_AUTH_BACKEND_BASE_URL = 'http://localhost:8000';

export type ServiceUrlEnv = {
  /** When true, a missing URL may use the dev default. Production builds pass false. */
  dev: boolean;
};

function normalizeBaseUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().replace(/\/+$/, '');
}

/**
 * Latest non-empty `authBackendBaseUrl` from a `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED` payload.
 * `initialSettings` is only the first snapshot; we keep this in sync when the shell pushes updates.
 * An update that omits the field leaves the previous URL in place.
 */
let authBackendBaseUrlFromShellMessages: string | null = null;

function rememberAuthBackendBaseUrlFromSettings(settings: Settings | null | undefined): void {
  const next = normalizeBaseUrl(settings?.authBackendBaseUrl ?? undefined);
  if (next) {
    authBackendBaseUrlFromShellMessages = next;
  }
}

/** Explicit identity URL from this frame's shell settings, with no dev default applied. */
export function readExplicitAuthBackendBaseUrl(): string | null {
  return (
    authBackendBaseUrlFromShellMessages ??
    normalizeBaseUrl(shellui.initialSettings?.authBackendBaseUrl)
  );
}

/**
 * Identity-service origin for this frame.
 * Uses `settings.authBackendBaseUrl` (the shell's `backend.url` for this frame).
 * The dev server falls back to `http://localhost:8000`. A production build returns null.
 */
export function resolveAuthBackendBaseUrl(
  raw: string | null | undefined,
  env: ServiceUrlEnv = { dev: import.meta.env.DEV },
): string | null {
  const explicit = normalizeBaseUrl(raw);
  if (explicit) return explicit;
  return env.dev ? DEV_AUTH_BACKEND_BASE_URL : null;
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
 * Identity-service base URL from this frame's shell settings.
 * Null in a production build when the shell did not send `authBackendBaseUrl`.
 */
export function getAuthBackendBaseUrl(): string | null {
  return resolveAuthBackendBaseUrl(readExplicitAuthBackendBaseUrl());
}

/** Thrown when a request would send the session token without an identity URL from the shell. */
export class AuthBackendNotConfiguredError extends Error {
  constructor() {
    super(
      'Identity URL is not configured. Set backend.url in the host shell config. This build does not call identity-service until that URL is set.',
    );
    this.name = 'AuthBackendNotConfiguredError';
  }
}

/** Identity URL for a request that sends the session token. Throws instead of guessing. */
export function requireAuthBackendBaseUrl(): string {
  const url = getAuthBackendBaseUrl();
  if (!url) throw new AuthBackendNotConfiguredError();
  return url;
}
