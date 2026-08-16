import { useEffect, useState } from 'react';
import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';

function normalizeBaseUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().replace(/\/+$/, '');
}

/**
 * Shell `backend.url` via SDK `authBackendBaseUrl` — updates when settings arrive.
 */
export function useShelluiAuthBackendBaseUrl(): string | null {
  const [baseUrl, setBaseUrl] = useState<string | null>(() =>
    normalizeBaseUrl(shellui.initialSettings?.authBackendBaseUrl),
  );

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      const next = normalizeBaseUrl(settings?.authBackendBaseUrl ?? undefined);
      if (next) setBaseUrl(next);
    };

    const offSettings = addMessageListener('SHELLUI_SETTINGS', apply);
    const offUpdated = addMessageListener('SHELLUI_SETTINGS_UPDATED', apply);
    return () => {
      offSettings();
      offUpdated();
    };
  }, []);

  return baseUrl;
}
