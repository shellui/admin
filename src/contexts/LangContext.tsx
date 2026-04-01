import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import shellui from '@shellui/sdk';
import i18n from '@/i18n';

const LangContext = createContext('en');

export function getLangFromSettings(settings: import('@shellui/sdk').Settings | null | undefined) {
  const code = settings?.language?.code;
  return code === 'fr' || code === 'en' ? code : 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState(
    () => getLangFromSettings(shellui.initialSettings) || i18n.language || 'en',
  );

  useEffect(() => {
    const applyLang = (newLang: string) => {
      if (newLang !== i18n.language) {
        void i18n.changeLanguage(newLang);
      }
      setLang(newLang);
    };

    const handleSettings = (message: {
      payload?: { settings?: import('@shellui/sdk').Settings };
    }) => {
      const settings = message.payload?.settings;
      if (settings) {
        applyLang(getLangFromSettings(settings));
      }
    };

    const initial =
      getLangFromSettings(shellui.initialSettings) || i18n.language || 'en';
    applyLang(initial);

    const cleanupUpdated = shellui.addMessageListener('SHELLUI_SETTINGS_UPDATED', handleSettings);
    const cleanupSettings = shellui.addMessageListener('SHELLUI_SETTINGS', handleSettings);

    return () => {
      cleanupUpdated();
      cleanupSettings();
    };
  }, []);

  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang() {
  const lang = useContext(LangContext);
  return lang ?? 'en';
}
