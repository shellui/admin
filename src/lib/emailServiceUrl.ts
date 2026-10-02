import type { Settings } from '@shellui/sdk';

/** Production origin. Callers append `/api/v1/...`. No trailing slash. */
export const DEFAULT_EMAIL_SERVICE_URL = 'https://email.shellui.com';

/**
 * Host `email` block in shellui.config, delivered on SDK settings the same way as
 * `storage` and `hosting`. SDK 0.5.0 has no `email` field yet, so this is read
 * from the settings object when the shell forwards it.
 */
export interface SettingsEmail {
  /** Base URL of email-service. Omitted values use `DEFAULT_EMAIL_SERVICE_URL`. */
  url?: string;
  /** When false, hide Admin → Email. Default: shown. */
  showInAdmin?: boolean;
}

export function normalizeServiceOrigin(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().replace(/\/+$/, '');
}

export function resolveEmailServiceUrl(raw: string | null | undefined): string {
  return normalizeServiceOrigin(raw) ?? DEFAULT_EMAIL_SERVICE_URL;
}

export function readSettingsEmail(settings: Settings | null | undefined): SettingsEmail {
  const email = (settings as (Settings & { email?: SettingsEmail | null }) | null | undefined)
    ?.email;
  return {
    url: resolveEmailServiceUrl(email?.url),
    showInAdmin: email?.showInAdmin,
  };
}

export function isEmailAdminEnabled(email: SettingsEmail | null | undefined): boolean {
  return email?.showInAdmin !== false;
}
