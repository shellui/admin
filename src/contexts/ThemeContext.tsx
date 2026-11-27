import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { addParentSettingsListener } from '@/lib/parentSettingsListener';
import { getTrustedShellSettings } from '@/lib/trustedShellSettings';
import { getAppearanceFromPayload, applyThemeToDocument } from '@/lib/theme';

const ThemeContext = createContext<import('@shellui/sdk').Appearance | null>(null);

function getPayloadFromMessage(message: { payload?: unknown }) {
  const payload = message?.payload;
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (p.settings != null) return payload as { settings: import('@shellui/sdk').Settings };
  if (p.appearance != null) return { settings: payload as import('@shellui/sdk').Settings };
  return null;
}

export function ThemeProvider({
  initialAppearance,
  children,
}: {
  initialAppearance?: import('@shellui/sdk').Appearance | null;
  children: ReactNode;
}) {
  const [appearance, setAppearance] = useState(
    () => initialAppearance ?? getTrustedShellSettings()?.appearance ?? null,
  );

  useEffect(() => {
    const apply = (next: import('@shellui/sdk').Appearance | null) => {
      applyThemeToDocument(next);
      setAppearance(next);
    };

    const handleSettings = (message: Parameters<typeof getPayloadFromMessage>[0]) => {
      const payload = getPayloadFromMessage(message);
      if (payload) {
        const next = getAppearanceFromPayload(payload);
        apply(next);
      }
    };

    apply(initialAppearance ?? getTrustedShellSettings()?.appearance ?? null);

    return addParentSettingsListener(handleSettings);
  }, [initialAppearance]);

  return <ThemeContext.Provider value={appearance}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext) ?? null;
}
