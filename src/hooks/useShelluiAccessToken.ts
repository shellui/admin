import { useEffect, useRef, useState } from 'react';
import shellui, { addMessageListener, sendMessageToParent } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';

/** Ask the shell again when JWT `exp` is this close, in seconds. */
export const SHELL_ACCESS_TOKEN_LEEWAY_SECONDS = 90;

function readJwtExp(token: string): number | null {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (b64.length % 4)) % 4;
    const json = atob(`${b64}${'='.repeat(padLen)}`);
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp : null;
  } catch {
    return null;
  }
}

/** True when the token is missing or its JWT `exp` is inside the leeway. */
export function shellAccessTokenRefreshDue(
  token: string | null,
  nowSeconds = Date.now() / 1000,
): boolean {
  if (!token) return true;
  const exp = readJwtExp(token);
  if (exp === null) return false;
  return exp - nowSeconds <= SHELL_ACCESS_TOKEN_LEEWAY_SECONDS;
}

/**
 * Keep the previous token when a settings payload omits `accessToken` while `user` is still set.
 * A payload with `user: null` and no token clears it.
 */
export function reconcileShellAccessToken(prev: string | null, settings: Settings): string | null {
  const incoming = settings.accessToken;
  if (typeof incoming === 'string' && incoming.length > 0) return incoming;
  if (settings.user === null) return null;
  return prev;
}

function requestShellSettings(): void {
  sendMessageToParent({
    type: 'SHELLUI_SETTINGS_REQUESTED',
    payload: {},
  });
}

/**
 * Returns the **JWT access token** from Shellui `Settings.accessToken`.
 *
 * The parent shell copies the signed-in session token into settings for trusted iframes (see
 * `buildSettingsForPropagation`); sub-apps must send it as `Authorization: Bearer <token>`.
 * Value is updated when `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED` arrives (e.g. refresh).
 * After subscribe, and again when the tab is shown with a missing or soon-expiring token, this
 * posts `SHELLUI_SETTINGS_REQUESTED` so a dropped shell push can be replaced.
 */
export function useShelluiAccessToken(): string | null {
  const [token, setToken] = useState<string | null>(
    () => shellui.initialSettings?.accessToken ?? null,
  );
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      // Ignore payloads without settings (do not clear the session on unrelated messages).
      if (!settings) return;
      setToken((prev) => {
        const next = reconcileShellAccessToken(prev, settings);
        return prev === next ? prev : next;
      });
    };
    const offSettings = addMessageListener('SHELLUI_SETTINGS', apply);
    const offUpdated = addMessageListener('SHELLUI_SETTINGS_UPDATED', apply);
    requestShellSettings();

    const onResume = () => {
      if (shellAccessTokenRefreshDue(tokenRef.current)) requestShellSettings();
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    window.addEventListener('pageshow', onResume);
    return () => {
      offSettings();
      offUpdated();
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
      window.removeEventListener('pageshow', onResume);
    };
  }, []);

  return token;
}
