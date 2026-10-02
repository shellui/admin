import { identityAuthFetch, parseErrorMessage } from '@/lib/adminIdentityFetch';

export const LOGIN_SUCCEEDED = 'identity.auth.login.succeeded';
export const LOGIN_FAILED = 'identity.auth.login.failed';

export const SCHEDULED_JOBS_DOCS_URL =
  'https://github.com/shellui/identity-service/blob/develop/docs/scheduled-jobs.md';

export type EventLogRow = {
  id: number;
  company_id: number | null;
  created_at: string;
  event_type: string;
  label: string;
  user_id: number | null;
  /** From the user row, or `data.email` once the user is gone (invitations, deleted users). */
  user_email: string | null;
  /** Event payload without empty values and secrets. */
  data: Record<string, unknown>;
};

export type EventLogListResponse = {
  count: number;
  page: number;
  page_size: number;
  results: EventLogRow[];
};

export type EventLogListParams = {
  page?: number;
  pageSize?: number;
  /** One or more catalog types. */
  eventTypes?: string[];
  userId?: number;
  /** Substring of the user email. */
  user?: string;
  /** ISO datetime, inclusive. */
  createdAfter?: string;
  /** ISO datetime, exclusive. */
  createdBefore?: string;
};

export type EventTypeRow = {
  type: string;
  label: string;
  description: string;
  /** False for log-only types (sign-ins). */
  webhook: boolean;
};

export type EventRetentionStatus = {
  data_retention_days: number;
  oldest_event_at: string | null;
  /** True when events outlive retention by more than a day: the purge job is not running. */
  stale_events: boolean;
};

async function getJson<T>(
  path: string,
  accessToken: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const res = await identityAuthFetch(path, accessToken, {}, { query });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as T;
}

export function fetchEventLog(
  accessToken: string,
  params: EventLogListParams = {},
): Promise<EventLogListResponse> {
  return getJson('/api/v1/events', accessToken, {
    page: params.page,
    page_size: params.pageSize,
    event_type: params.eventTypes?.length ? params.eventTypes.join(',') : undefined,
    user_id: params.userId,
    user: params.user?.trim() || undefined,
    created_after: params.createdAfter,
    created_before: params.createdBefore,
  });
}

export function fetchEventLogEntry(accessToken: string, eventId: number): Promise<EventLogRow> {
  return getJson(`/api/v1/events/${eventId}`, accessToken);
}

export async function fetchEventTypes(accessToken: string): Promise<EventTypeRow[]> {
  const body = await getJson<{ results: EventTypeRow[] }>('/api/v1/events/types', accessToken);
  return body.results;
}

export function fetchEventRetention(accessToken: string): Promise<EventRetentionStatus> {
  return getJson('/api/v1/events/retention', accessToken);
}

export function isFailureEvent(row: Pick<EventLogRow, 'event_type'>): boolean {
  return row.event_type === LOGIN_FAILED;
}

/** One-line summary of an event payload for tables. */
export function eventSummary(row: EventLogRow): string {
  const d = row.data;
  const text = (key: string) => (typeof d[key] === 'string' ? (d[key] as string) : '');
  if (row.event_type === LOGIN_SUCCEEDED || row.event_type === LOGIN_FAILED) {
    return [text('provider'), text('failure_reason')].filter(Boolean).join(' · ');
  }
  return text('display_name') || text('name') || text('email') || text('source');
}
