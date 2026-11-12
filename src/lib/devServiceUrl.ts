import { normalizeServiceOrigin } from '@/lib/emailServiceUrl';

/**
 * Service origin from a `VITE_*` env var. Used only in dev builds when the host
 * shell did not send the matching SDK setting (for example Admin opened in the
 * local Docker dev stack without an iframe parent).
 */
export function readDevServiceUrlFromEnv(value: string | undefined): string | null {
  if (!import.meta.env.DEV) return null;
  return normalizeServiceOrigin(value);
}
