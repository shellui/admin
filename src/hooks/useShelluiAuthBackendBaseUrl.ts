import { useEffect, useState } from 'react';
import { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';
import { readExplicitAuthBackendBaseUrl, resolveAuthBackendBaseUrl } from '@/lib/backendUrl';

function normalizeExplicit(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().replace(/\/+$/, '');
}

/**
 * Identity URL for this frame (`settings.authBackendBaseUrl`).
 * Updates when the shell pushes settings. A missing value uses the dev default
 * and is null in a production build.
 */
export function useShelluiAuthBackendBaseUrl(): string | null {
  const [explicit, setExplicit] = useState<string | null>(readExplicitAuthBackendBaseUrl);

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      if (!settings) return;
      const next = normalizeExplicit(settings.authBackendBaseUrl ?? undefined);
      if (next) setExplicit(next);
    };

    const offSettings = addMessageListener('SHELLUI_SETTINGS', apply);
    const offUpdated = addMessageListener('SHELLUI_SETTINGS_UPDATED', apply);
    return () => {
      offSettings();
      offUpdated();
    };
  }, []);

  return resolveAuthBackendBaseUrl(explicit);
}
