import { useEffect, useState } from 'react';
import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings, SettingsAdministration } from '@shellui/sdk';

function readAdministration(settings: Settings | null | undefined): SettingsAdministration | null {
  return settings?.administration ?? null;
}

/**
 * Custom admin navigation from the host shell (`administration` in shellui.config.ts),
 * delivered via `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED`.
 */
export function useShelluiAdministration(): SettingsAdministration | null {
  const [administration, setAdministration] = useState<SettingsAdministration | null>(() =>
    readAdministration(shellui.initialSettings),
  );

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      setAdministration(readAdministration(settings));
    };

    const offSettings = addMessageListener('SHELLUI_SETTINGS', apply);
    const offUpdated = addMessageListener('SHELLUI_SETTINGS_UPDATED', apply);
    return () => {
      offSettings();
      offUpdated();
    };
  }, []);

  return administration;
}
