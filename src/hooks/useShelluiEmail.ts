import { useEffect, useState } from 'react';
import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';
import { readSettingsEmail, type ResolvedEmailSettings } from '@/lib/emailServiceUrl';

/**
 * email-service origin from this frame's shell settings (`email` in shellui.config),
 * delivered via `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED`.
 * The dev server fills a missing `email.url`. A production build leaves it empty.
 */
export function useShelluiEmail(): ResolvedEmailSettings {
  const [email, setEmail] = useState<ResolvedEmailSettings>(() =>
    readSettingsEmail(shellui.initialSettings),
  );

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      if (!settings) return;
      const next = readSettingsEmail(settings);
      setEmail((prev) => {
        if (prev.url === next.url && prev.showInAdmin === next.showInAdmin) return prev;
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

  return email;
}
