import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type Settings, type ShellUIMessage } from '@shellui/sdk';
import i18n from '@/i18n';
import { addParentSettingsListener } from '@/lib/parentSettingsListener';
import { getTrustedShellSettings } from '@/lib/trustedShellSettings';

type AppLang = 'en' | 'fr';

const LangContext = createContext<AppLang>('en');

export function getLangFromSettings(settings: Settings | null | undefined): AppLang {
  const code = settings?.language?.code;
  return code === 'fr' ? 'fr' : 'en';
}

function settingsFromMessage(message: ShellUIMessage): Settings | undefined {
  const payload = message.payload;
  if (!payload || typeof payload !== 'object' || !('settings' in payload)) return undefined;
  return (payload as { settings?: Settings }).settings;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<AppLang>(() => getLangFromSettings(getTrustedShellSettings()));

  useEffect(() => {
    const applyLang = (newLang: AppLang) => {
      if (newLang !== i18n.language) {
        void i18n.changeLanguage(newLang);
      }
      setLang(newLang);
    };

    const handleSettings = (message: ShellUIMessage) => {
      const settings = settingsFromMessage(message);
      if (settings) {
        applyLang(getLangFromSettings(settings));
      }
    };

    applyLang(getLangFromSettings(getTrustedShellSettings()));

    return addParentSettingsListener(handleSettings);
  }, []);

  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang() {
  const lang = useContext(LangContext);
  return lang ?? 'en';
}
