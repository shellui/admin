/** First-version fallback when a nav item has no url yet. */
export const DEFAULT_CUSTOM_APP_URL = 'https://playground.shellui.com';

/**
 * Resolve an administration nav URL: absolute stays as-is; paths starting with `/`
 * are joined to the identity backend base URL.
 */
export function resolveAdminAppUrl(
  rawUrl: string | undefined,
  authBackendBaseUrl: string | null,
): string {
  const url = rawUrl?.trim();
  if (!url) return DEFAULT_CUSTOM_APP_URL;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/') && authBackendBaseUrl) {
    return `${authBackendBaseUrl.replace(/\/+$/, '')}${url}`;
  }
  return url;
}
