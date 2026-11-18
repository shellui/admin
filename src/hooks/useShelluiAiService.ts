import { useEffect, useState } from 'react';
import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';
import { readSettingsAiService, type SettingsAiService } from '@/lib/aiServiceUrl';

/**
 * ai-service origin from the host shell (`aiService` in shellui.config),
 * delivered via `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED`.
 * Falls back to `VITE_AI_SERVICE_URL` when the shell sends no URL.
 */
export function useShelluiAiService(): SettingsAiService | null {
  const [aiService, setAiService] = useState<SettingsAiService | null>(() =>
    readSettingsAiService(shellui.initialSettings),
  );

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      if (!settings) return;
      const next = readSettingsAiService(settings);
      setAiService((prev) => {
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

  return aiService;
}
