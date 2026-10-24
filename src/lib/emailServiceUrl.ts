import type { Settings, SettingsEmail } from '@shellui/sdk';

export type { SettingsEmail };

/**
 * Host `email` block in shellui.config, delivered as `settings.email`, the same
 * way as `storage` and `hosting`. There is no built-in default: without a URL
 * from the shell, Admin has no email service and hides Email.
 */

export function normalizeServiceOrigin(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().replace(/\/+$/, '');
}

/** Email-service origin without trailing slash, or `null` when none is configured. */
export function resolveEmailServiceUrl(raw: string | null | undefined): string | null {
  return normalizeServiceOrigin(raw);
}

/** `settings.email` with a usable URL, or `null`. */
export function readSettingsEmail(settings: Settings | null | undefined): SettingsEmail | null {
  const email = settings?.email;
  const url = resolveEmailServiceUrl(email?.url);
  if (!url) return null;
  return {
    url,
    showInAdmin: email?.showInAdmin,
  };
}

/** Admin Email needs a URL, like Hosting. `showInAdmin: false` still hides it. */
export function isEmailAdminEnabled(email: SettingsEmail | null | undefined): boolean {
  return Boolean(normalizeServiceOrigin(email?.url)) && email?.showInAdmin !== false;
}
