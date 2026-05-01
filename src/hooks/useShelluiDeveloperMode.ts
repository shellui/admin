import { useEffect, useState } from 'react';
import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';

export function useShelluiDeveloperMode(): boolean {
  const [enabled, setEnabled] = useState<boolean>(
    () => shellui.initialSettings?.developerFeatures?.enabled ?? false,
  );

  useEffect(() => {
    const off = addMessageListener('SHELLUI_SETTINGS', (message) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      setEnabled(settings?.developerFeatures?.enabled ?? false);
    });
    return off;
  }, []);

  return enabled;
}
