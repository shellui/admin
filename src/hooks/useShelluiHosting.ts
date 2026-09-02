import { useEffect, useState } from 'react';
import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';

/** Hosting-service connection from host `hosting` in shellui.config.json. */
export interface SettingsHosting {
  /** Base URL of hosting-service (no trailing slash). */
  url: string;
  /** When false, hide Admin → Hosting even if `url` is set. Default: true when `url` is set. */
  showInAdmin?: boolean;
}

function readHosting(settings: Settings | null | undefined): SettingsHosting | null {
  return (settings as Settings & { hosting?: SettingsHosting | null })?.hosting ?? null;
}

export function isHostingAdminEnabled(hosting: SettingsHosting | null | undefined): boolean {
  return Boolean(hosting?.url?.trim()) && hosting?.showInAdmin !== false;
}

/**
 * Hosting config from the host shell (`hosting` in shellui.config.ts),
 * delivered via `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED`.
 */
export function useShelluiHosting(): SettingsHosting | null {
  const [hosting, setHosting] = useState<SettingsHosting | null>(() =>
    readHosting(shellui.initialSettings),
  );

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      if (!settings) return;
      const next = readHosting(settings);
      setHosting((prev) => {
        if (prev?.url === next?.url && prev?.showInAdmin === next?.showInAdmin) return prev;
        return next;
      });
    };

    const offSettings = addMessageListener('SHELLUI_SETTINGS', apply);
    const offUpdated = addMessageListener('SHELLUI_SETTINGS_UPDATED', apply);
    return () => {
      offSettings();
      offUpdated();
    };
  }, []);

  return hosting;
}
