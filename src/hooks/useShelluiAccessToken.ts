import { useEffect, useState } from 'react';
import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';

/**
 * Returns the **JWT access token** from Shellui `Settings.accessToken`.
 *
 * The parent shell copies the signed-in session token into settings for trusted iframes (see
 * `buildSettingsForPropagation`); sub-apps must send it as `Authorization: Bearer <token>`.
 * Value is updated when `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED` arrives (e.g. refresh).
 */
export function useShelluiAccessToken(): string | null {
  const [token, setToken] = useState<string | null>(
    () => shellui.initialSettings?.accessToken ?? null,
  );

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      // Ignore payloads without settings (do not clear the session on unrelated messages).
      if (!settings) return;
      const next = settings.accessToken ?? null;
      setToken((prev) => (prev === next ? prev : next));
    };
    const offSettings = addMessageListener('SHELLUI_SETTINGS', apply);
    const offUpdated = addMessageListener('SHELLUI_SETTINGS_UPDATED', apply);
    return () => {
      offSettings();
      offUpdated();
    };
  }, []);

  return token;
}
