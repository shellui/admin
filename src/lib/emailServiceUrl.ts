import type { Settings, SettingsEmail } from '@shellui/sdk';

export type { SettingsEmail };

/** Production origin. Callers append `/api/v1/...`. No trailing slash. */
export const DEFAULT_EMAIL_SERVICE_URL = 'https://email.shellui.com';

/**
 * Host `email` block in shellui.config, delivered as `settings.email`
 * (`SettingsEmail` on `@shellui/sdk` 0.6.0-beta.1), the same way as `storage` and
 * `hosting`. The shell fills a missing `url` with the production origin; Admin still
 * normalizes it and falls back when the value is absent.
 */

export function normalizeServiceOrigin(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().replace(/\/+$/, '');
}

export function resolveEmailServiceUrl(raw: string | null | undefined): string {
  return normalizeServiceOrigin(raw) ?? DEFAULT_EMAIL_SERVICE_URL;
}

export function readSettingsEmail(settings: Settings | null | undefined): SettingsEmail {
  const email = settings?.email;
  return {
    url: resolveEmailServiceUrl(email?.url),
    showInAdmin: email?.showInAdmin,
  };
}

export function isEmailAdminEnabled(email: SettingsEmail | null | undefined): boolean {
  return email?.showInAdmin !== false;
}
