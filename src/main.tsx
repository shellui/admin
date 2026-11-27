import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import shellui from '@shellui/sdk';
import { LangProvider, getLangFromSettings } from '@/contexts/LangContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { getAppearanceFromSettings, applyThemeToDocument } from '@/lib/theme';
import { isEmbeddedInShell } from '@/lib/embed';
import { hydrateAiServiceUrlFromSdk } from '@/lib/aiServiceUrl';
import { hydrateAuthBackendBaseUrlFromSdk } from '@/lib/backendUrl';
import { snapshotTrustedShellSettings, getTrustedShellSettings } from '@/lib/trustedShellSettings';
import { setupContentFrameMessagePropagation } from '@/lib/propagateToContentFrames';
import { setupEmbeddedAppMessageSecurity } from '@/lib/embeddedAppOrigins';
import { StandaloneNotice } from '@/components/StandaloneNotice';
import i18n, { i18nInit } from '@/i18n';
import { router } from '@/router';
import '@/index.css';

async function bootstrap() {
  await i18nInit;

  if (!isEmbeddedInShell()) {
    await i18n.changeLanguage(i18n.language || 'en');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <StandaloneNotice />
      </StrictMode>,
    );
    return;
  }

  await shellui.init();
  snapshotTrustedShellSettings(shellui.initialSettings);
  setupEmbeddedAppMessageSecurity();
  hydrateAuthBackendBaseUrlFromSdk();
  hydrateAiServiceUrlFromSdk();
  setupContentFrameMessagePropagation();
  const trusted = getTrustedShellSettings();
  const initialLang = getLangFromSettings(trusted);
  await i18n.changeLanguage(initialLang);
  const initialTheme = getAppearanceFromSettings(trusted);
  applyThemeToDocument(initialTheme);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider initialAppearance={initialTheme}>
        <LangProvider>
          <RouterProvider router={router} />
        </LangProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

void bootstrap();
