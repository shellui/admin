import shellui, { addMessageListener, collectOriginsFromUrls } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';
import { readIsStaff } from '@/hooks/useShelluiIsStaff';
import { resolveAdminAppUrl } from '@/lib/resolveAdminAppUrl';

const SETTINGS_MESSAGE_TYPES = ['SHELLUI_SETTINGS', 'SHELLUI_SETTINGS_UPDATED'] as const;

/**
 * URLs of the cross-origin apps the admin chrome embeds and talks to over postMessage.
 * Mirrors the nav built in useAdminContentNavigation: storage Files, plus custom
 * `administration.navigation` apps that open inside admin. Swagger and ReDoc frames
 * ignore messages, and hash pages are same-origin, so neither needs trust.
 */
export function collectEmbeddedAppUrls(settings: Settings | null | undefined): string[] {
  if (!settings) return [];
  const urls: string[] = [];

  const storageUrl = settings.storage?.url?.trim();
  const filesUrl = settings.storage?.filesUrl?.trim();
  if (storageUrl && filesUrl) urls.push(filesUrl);

  const isStaff = readIsStaff(settings);
  const authBackendBaseUrl = settings.authBackendBaseUrl?.trim() || null;
  for (const item of settings.administration?.navigation ?? []) {
    if (item.requiresStaff && !isStaff) continue;
    if (item.openIn === 'external') continue;
    urls.push(resolveAdminAppUrl(item.url, authBackendBaseUrl));
  }

  return urls;
}

/** Origins admin must accept SDK messages from (invalid and relative URLs are dropped, deduped). */
export function collectEmbeddedAppOrigins(settings: Settings | null | undefined): string[] {
  return collectOriginsFromUrls(...collectEmbeddedAppUrls(settings));
}

function applyEmbeddedAppMessageSecurity(settings: Settings | null | undefined): void {
  // configureMessageSecurity replaces the whole extra list, so always pass the full set.
  shellui.configureMessageSecurity({ allowedOrigins: collectEmbeddedAppOrigins(settings) });
}

/**
 * The SDK only trusts its own origin and the parent shell. Admin also hosts apps
 * (Files, custom admin apps), so allowlist their origins after init and whenever
 * the shell pushes new settings. Without it, messages from files.shellui.com are
 * dropped and the Files page stays blank.
 */
export function setupEmbeddedAppMessageSecurity(): () => void {
  applyEmbeddedAppMessageSecurity(shellui.initialSettings);
  const offs = SETTINGS_MESSAGE_TYPES.map((type) =>
    addMessageListener(type, (message) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      if (settings) applyEmbeddedAppMessageSecurity(settings);
    }),
  );
  return () => {
    for (const off of offs) off();
  };
}
