import { useEffect, useState } from 'react';
import type { Settings, SettingsAdministration } from '@shellui/sdk';
import { addParentSettingsListener } from '@/lib/parentSettingsListener';
import { getTrustedShellSettings } from '@/lib/trustedShellSettings';

function readAdministration(settings: Settings | null | undefined): SettingsAdministration | null {
  return settings?.administration ?? null;
}

/**
 * Custom admin navigation from the host shell (`administration` in shellui.config.json),
 * delivered via `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED`.
 */
export function useShelluiAdministration(): SettingsAdministration | null {
  const [administration, setAdministration] = useState<SettingsAdministration | null>(() =>
    readAdministration(getTrustedShellSettings()),
  );

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      setAdministration(readAdministration(settings));
    };

    const off = addParentSettingsListener(apply);
    return () => {
      off();
    };
  }, []);

  return administration;
}
