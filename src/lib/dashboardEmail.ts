import { EmailApiError } from '@/lib/emailApiErrors';
import type { EmailApiClient } from '@/lib/emailApi';
import type { EmailStats } from '@/lib/emailTypes';

export type EmailDashboardQuiet = 'unavailable' | 'no_provider';

export type EmailDashboardSnapshot =
  | { stats: EmailStats; quiet: null }
  | { stats: null; quiet: EmailDashboardQuiet };

function isNoProvider(error: unknown): boolean {
  return error instanceof EmailApiError && error.errorCode === 'provider_not_configured';
}

/**
 * Load the dashboard email block.
 * A missing provider or an unreachable email-service becomes a quiet empty state.
 * This function does not throw.
 */
export async function loadEmailDashboardSnapshot(
  api: Pick<EmailApiClient, 'fetchStats' | 'fetchProvider'>,
): Promise<EmailDashboardSnapshot> {
  let stats: EmailStats | null = null;
  let statsError: unknown = null;
  try {
    stats = await api.fetchStats();
  } catch (error) {
    statsError = error;
  }

  let configured: boolean | null = null;
  let providerError: unknown = null;
  try {
    configured = (await api.fetchProvider()).configured;
  } catch (error) {
    providerError = error;
  }

  if (isNoProvider(statsError) || isNoProvider(providerError) || configured === false) {
    return { stats: null, quiet: 'no_provider' };
  }
  if (stats) return { stats, quiet: null };
  return { stats: null, quiet: 'unavailable' };
}
