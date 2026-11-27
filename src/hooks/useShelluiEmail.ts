import { useEffect, useState } from 'react';
import type { Settings } from '@shellui/sdk';
import { readSettingsEmail, type SettingsEmail } from '@/lib/emailServiceUrl';
import { addParentSettingsListener } from '@/lib/parentSettingsListener';
import { getTrustedShellSettings } from '@/lib/trustedShellSettings';

/**
 * email-service origin from the host shell (`email` in shellui.config),
 * delivered via `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED`.
 * `null` when the shell sends no `email.url` and `VITE_EMAIL_URL` is unset.
 */
export function useShelluiEmail(): SettingsEmail | null {
  const [email, setEmail] = useState<SettingsEmail | null>(() =>
    readSettingsEmail(getTrustedShellSettings()),
  );

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      if (!settings) return;
      const next = readSettingsEmail(settings);
      setEmail((prev) => {
        if (prev?.url === next?.url && prev?.showInAdmin === next?.showInAdmin) return prev;
        return next;
      });
    };

    const off = addParentSettingsListener(apply);
    return () => {
      off();
    };
  }, []);

  return email;
}
