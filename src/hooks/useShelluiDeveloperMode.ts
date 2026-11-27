import { useEffect, useState } from 'react';
import shellui from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';
import { addParentSettingsListener } from '@/lib/parentSettingsListener';

export function useShelluiDeveloperMode(): boolean {
  const [enabled, setEnabled] = useState<boolean>(
    () => shellui.initialSettings?.developerFeatures?.enabled ?? false,
  );

  useEffect(() => {
    const off = addParentSettingsListener((message) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      setEnabled(settings?.developerFeatures?.enabled ?? false);
    });
    return off;
  }, []);

  return enabled;
}
