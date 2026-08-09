import { useEffect, useState } from 'react';
import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings, SettingsStorage } from '@shellui/sdk';

function readStorage(settings: Settings | null | undefined): SettingsStorage | null {
  return settings?.storage ?? null;
}

/**
 * Storage config from the host shell (`storage` in shellui.config.ts),
 * delivered via `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED`.
 */
export function useShelluiStorage(): SettingsStorage | null {
  const [storage, setStorage] = useState<SettingsStorage | null>(() =>
    readStorage(shellui.initialSettings),
  );

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      setStorage(readStorage(settings));
    };

    const offSettings = addMessageListener('SHELLUI_SETTINGS', apply);
    const offUpdated = addMessageListener('SHELLUI_SETTINGS_UPDATED', apply);
    return () => {
      offSettings();
      offUpdated();
    };
  }, []);

  return storage;
}
