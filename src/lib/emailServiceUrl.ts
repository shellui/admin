import type { Settings, SettingsEmail } from '@shellui/sdk';
import type { ServiceUrlEnv } from '@/lib/backendUrl';

export type { SettingsEmail };

/** Local email-service origin when the dev server has no `email.url`. No trailing slash. */
export const DEFAULT_EMAIL_SERVICE_URL = 'http://localhost:8003';

/** Email block after Admin resolves a missing URL. Production leaves `url` null. */
export type ResolvedEmailSettings = {
  url: string | null;
  showInAdmin?: boolean;
};

/**
 * Host `email` block in shellui.config, delivered as `settings.email`
 * (`SettingsEmail` on `@shellui/sdk` 0.6.0), the same way as `storage` and
 * `hosting`. An explicit `url` is used as sent. The dev server fills a missing
 * URL with `http://localhost:8003`. A production build leaves it empty so
 * the session token is not sent to a guessed origin.
 */

export function normalizeServiceOrigin(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().replace(/\/+$/, '');
}

export function resolveEmailServiceUrl(
  raw: string | null | undefined,
  env: ServiceUrlEnv = { dev: import.meta.env.DEV },
): string | null {
  const explicit = normalizeServiceOrigin(raw);
  if (explicit) return explicit;
  return env.dev ? DEFAULT_EMAIL_SERVICE_URL : null;
}

export function readSettingsEmail(
  settings: Settings | null | undefined,
  env?: ServiceUrlEnv,
): ResolvedEmailSettings {
  const email = settings?.email;
  return {
    url: resolveEmailServiceUrl(email?.url, env),
    showInAdmin: email?.showInAdmin,
  };
}

export function isEmailAdminEnabled(
  email: { url?: string | null; showInAdmin?: boolean } | null | undefined,
): boolean {
  if (!email?.url) return false;
  return email.showInAdmin !== false;
}
