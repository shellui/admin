import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import { parseErrorMessage, serviceAuthFetch } from '@/lib/serviceAuthFetch';

/**
 * identity-service scheduled job monitoring (staff only).
 * `GET /api/v1/scheduled-jobs`, `GET /api/v1/scheduled-jobs/<job>/runs`,
 * `GET /api/v1/scheduled-jobs/runs/<id>`. Responses carry keys only; the UI translates them.
 */

export const SCHEDULED_JOB_NAMES = ['retry_webhooks', 'purge_expired_data'] as const;
export type ScheduledJobName = (typeof SCHEDULED_JOB_NAMES)[number];

export const SCHEDULED_JOB_HEALTH = ['healthy', 'overdue', 'failing', 'disabled'] as const;
export type ScheduledJobHealth = (typeof SCHEDULED_JOB_HEALTH)[number];

export const SCHEDULED_JOB_RUN_STATUSES = [
  'running',
  'succeeded',
  'failed',
  'skipped_locked',
] as const;
export type ScheduledJobRunStatus = (typeof SCHEDULED_JOB_RUN_STATUSES)[number];

export const SCHEDULED_JOB_ERROR_KEYS = [
  'database_error',
  'redis_error',
  'timeout',
  'network_error',
  'interrupted',
  'unexpected_error',
] as const;

/** `counts` keys per job, in display order (same names as the `kind` metric label). */
export const SCHEDULED_JOB_COUNT_KEYS: Record<ScheduledJobName, readonly string[]> = {
  retry_webhooks: [
    'webhook_deliveries_attempted',
    'webhook_deliveries_succeeded',
    'webhook_deliveries_failed',
    'webhook_deliveries_given_up',
    'email_events_attempted',
    'email_events_succeeded',
    'email_events_failed',
    'email_events_given_up',
  ],
  purge_expired_data: [
    'events',
    'webhook_deliveries',
    'email_events',
    'scim_provisioning_events',
    'scheduled_job_runs',
  ],
};

export type ScheduledJobRun = {
  id: number;
  job: string;
  trigger: 'celery' | 'command' | string;
  status: ScheduledJobRunStatus | string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  counts: Record<string, number | boolean>;
  error_key: string | null;
  error_class: string | null;
  error_message: string | null;
  host: string;
  request_id: string;
  event_log_id: number | null;
};

export type ScheduledJobStatus = {
  job: ScheduledJobName | string;
  health: ScheduledJobHealth | string;
  overdue: boolean;
  interval_seconds: number;
  overdue_after_seconds: number;
  last_run: ScheduledJobRun | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_skipped_at: string | null;
  last_duration_ms: number | null;
  last_counts: Record<string, number | boolean>;
  next_expected_at: string | null;
  last_24h: { succeeded: number; failed: number };
  skipped_locked_total: number;
};

export type ScheduledJobsOverview = {
  generated_at: string;
  scheduler_enabled: boolean;
  redis_reachable: boolean | null;
  beat_last_seen_at: string | null;
  beat_stale: boolean;
  jobs: ScheduledJobStatus[];
};

export type ScheduledJobRunDeliveryAttempt = {
  id: number;
  delivery_id: string;
  company_id: number;
  event_type: string;
  status: string;
  http_status: number | null;
  attempt_number: number;
  duration_ms: number | null;
  trigger: string | null;
  created_at: string;
};

export type ScheduledJobRunEmailEvent = {
  id: string;
  company_id: number;
  event_type: string;
  status: string;
  attempt_count: number;
  delivered_at: string | null;
};

export type ScheduledJobRunDetail = ScheduledJobRun & {
  webhook_delivery_attempts: ScheduledJobRunDeliveryAttempt[];
  webhook_delivery_attempts_truncated: boolean;
  email_events: ScheduledJobRunEmailEvent[];
  email_events_truncated: boolean;
};

/** Thrown for 401/403 so the UI can hide the panel instead of showing an error. */
export class ScheduledJobsForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduledJobsForbiddenError';
  }
}

async function getJson<T>(
  path: string,
  accessToken: string,
  query?: Record<string, string | number | undefined>,
  baseUrl: string = getAuthBackendBaseUrl(),
): Promise<T> {
  const res = await serviceAuthFetch(baseUrl, path, accessToken, {}, { query });
  const body = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) {
    throw new ScheduledJobsForbiddenError(parseErrorMessage(body) || 'Forbidden');
  }
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as T;
}

export function fetchScheduledJobs(
  accessToken: string,
  baseUrl?: string,
): Promise<ScheduledJobsOverview> {
  return getJson('/api/v1/scheduled-jobs', accessToken, undefined, baseUrl);
}

export async function fetchScheduledJobRuns(
  accessToken: string,
  job: string,
  limit = 10,
  baseUrl?: string,
): Promise<ScheduledJobRun[]> {
  const body = await getJson<{ results?: ScheduledJobRun[] }>(
    `/api/v1/scheduled-jobs/${encodeURIComponent(job)}/runs`,
    accessToken,
    { limit },
    baseUrl,
  );
  return Array.isArray(body?.results) ? body.results : [];
}

export function fetchScheduledJobRun(
  accessToken: string,
  runId: number,
  baseUrl?: string,
): Promise<ScheduledJobRunDetail> {
  return getJson(`/api/v1/scheduled-jobs/runs/${runId}`, accessToken, undefined, baseUrl);
}

/** i18n key for a value from the API, with a generic fallback for values this UI does not know. */
export function healthLabelKey(health: string): string {
  return (SCHEDULED_JOB_HEALTH as readonly string[]).includes(health)
    ? `scheduledJobsHealth_${health}`
    : 'scheduledJobsHealth_unknown';
}

export function runStatusLabelKey(status: string): string {
  return (SCHEDULED_JOB_RUN_STATUSES as readonly string[]).includes(status)
    ? `scheduledJobsRunStatus_${status}`
    : 'scheduledJobsRunStatus_unknown';
}

export function errorLabelKey(errorKey: string | null): string | null {
  if (!errorKey) return null;
  return (SCHEDULED_JOB_ERROR_KEYS as readonly string[]).includes(errorKey)
    ? `scheduledJobsError_${errorKey}`
    : 'scheduledJobsError_unexpected_error';
}

export function jobLabelKey(job: string): string {
  return (SCHEDULED_JOB_NAMES as readonly string[]).includes(job)
    ? `scheduledJobsJob_${job}`
    : 'scheduledJobsJob_unknown';
}

/** `counts` entries in display order, integers only (drops `complete`). */
export function orderedCounts(
  job: string,
  counts: Record<string, number | boolean> | null | undefined,
): { key: string; value: number }[] {
  if (!counts) return [];
  const known = SCHEDULED_JOB_COUNT_KEYS[job as ScheduledJobName] ?? [];
  const keys = [...known, ...Object.keys(counts).filter((k) => !known.includes(k))];
  return keys
    .filter((k) => typeof counts[k] === 'number')
    .map((k) => ({ key: k, value: counts[k] as number }));
}

/** Seconds between `iso` and `now` (positive in the past), or null. */
export function secondsSince(
  iso: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((now - t) / 1000);
}

/** Relative time with `Intl.RelativeTimeFormat` ("2 minutes ago", "dans 1 heure"). */
export function formatRelativeTime(
  iso: string | null | undefined,
  locale: string,
  now: number = Date.now(),
): string | null {
  const seconds = secondsSince(iso, now);
  if (seconds == null) return null;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(seconds);
  const sign = seconds > 0 ? -1 : 1;
  if (abs < 60) return rtf.format(sign * abs, 'second');
  if (abs < 3600) return rtf.format(sign * Math.round(abs / 60), 'minute');
  if (abs < 86400) return rtf.format(sign * Math.round(abs / 3600), 'hour');
  return rtf.format(sign * Math.round(abs / 86400), 'day');
}

export function formatDurationMs(ms: number | null | undefined, locale: string): string | null {
  if (ms == null) return null;
  if (ms < 1000) {
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'millisecond' }).format(ms);
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'second',
    maximumFractionDigits: 1,
  }).format(ms / 1000);
}
