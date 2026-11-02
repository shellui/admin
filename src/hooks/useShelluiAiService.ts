import { useEffect, useState } from 'react';
import { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';
import {
  getAiServiceBaseUrl,
  readSettingsAiService,
  type SettingsAiService,
} from '@/lib/aiServiceUrl';

/**
 * ai-service origin from the host shell (`aiService` in shellui.config),
 * delivered via `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED`.
 * Falls back to `VITE_AI_SERVICE_URL` when the shell sends no URL.
 */
export function useShelluiAiService(): SettingsAiService | null {
  const [aiService, setAiService] = useState<SettingsAiService | null>(() => {
    const url = getAiServiceBaseUrl();
    return url ? { url } : null;
  });

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      if (!settings) return;
      const fromSettings = readSettingsAiService(settings);
      const url = fromSettings?.url ?? getAiServiceBaseUrl();
      setAiService((prev) => {
        if (prev?.url === url) return prev;
        return url ? { url } : null;
      });
    };

    const offSettings = addMessageListener('SHELLUI_SETTINGS', apply);
    const offUpdated = addMessageListener('SHELLUI_SETTINGS_UPDATED', apply);
    return () => {
      offSettings();
      offUpdated();
    };
  }, []);

  return aiService;
}
