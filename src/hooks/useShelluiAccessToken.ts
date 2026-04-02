import { useEffect, useState } from 'react';
import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';

/**
 * Returns the **JWT access token** from ShellUI `Settings.accessToken`.
 *
 * The parent shell copies the signed-in session token into settings for trusted iframes (see
 * `buildSettingsForPropagation`); sub-apps must send it as `Authorization: Bearer <token>`.
 * Value is updated when a new `SHELLUI_SETTINGS` message arrives (e.g. after token refresh).
 */
export function useShelluiAccessToken(): string | null {
  const [token, setToken] = useState<string | null>(() => shellui.initialSettings?.accessToken ?? null);

  useEffect(() => {
    const off = addMessageListener('SHELLUI_SETTINGS', (message) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      setToken(settings?.accessToken ?? null);
    });
    return off;
  }, []);

  return token;
}
