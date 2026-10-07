import { parseErrorMessage, serviceAuthFetch } from '@/lib/serviceAuthFetch';
import type { WebhookServiceKey } from '@/lib/webhookServices';

export const LOGIN_SUCCEEDED = 'identity.auth.login.succeeded';
export const LOGIN_FAILED = 'identity.auth.login.failed';

/** Service whose event log is read, with its API base URL. */
export type EventLogSource = {
  service: WebhookServiceKey;
  baseUrl: string;
};

const API_PREFIX: Record<WebhookServiceKey, string> = {
  identity: '/api/v1/events',
  storage: '/api/v1/actions/event-log',
  hosting: '/api/v1/actions/event-log',
};

/** Where the purge job is documented, per service. */
export const RETENTION_DOCS_URL: Record<WebhookServiceKey, string> = {
  identity: 'https://github.com/shellui/identity-service/blob/develop/docs/scheduled-jobs.md',
  storage: 'https://github.com/shellui/storage-service/blob/develop/docs/event-log.md#retention',
  hosting: 'https://github.com/shellui/hosting-service/blob/develop/docs/event-log.md#retention',
};

/** Admin route of a service event log: identity keeps the historical `/events`. */
export function eventsListPath(service: WebhookServiceKey): string {
  return service === 'identity' ? '/events' : `/${service}/events`;
}

export function eventDetailPath(service: WebhookServiceKey, eventId: number): string {
  return `${eventsListPath(service)}/${eventId}`;
}

export type EventLogRow = {
  id: number;
  company_id: number | null;
  created_at: string;
  event_type: string;
  label: string;
  user_id: number | null;
  /**
   * Identity: from the user row, or `data.email` once the user is gone.
   * Storage and hosting: email of the user who triggered the event, from their token.
   */
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
  source: EventLogSource,
  path: string,
  accessToken: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const res = await serviceAuthFetch(
    source.baseUrl,
    `${API_PREFIX[source.service]}${path}`,
    accessToken,
    {},
    { query },
  );
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as T;
}

export function fetchEventLog(
  source: EventLogSource,
  accessToken: string,
  params: EventLogListParams = {},
): Promise<EventLogListResponse> {
  return getJson(source, '', accessToken, {
    page: params.page,
    page_size: params.pageSize,
    event_type: params.eventTypes?.length ? params.eventTypes.join(',') : undefined,
    user_id: params.userId,
    user: params.user?.trim() || undefined,
    created_after: params.createdAfter,
    created_before: params.createdBefore,
  });
}

export function fetchEventLogEntry(
  source: EventLogSource,
  accessToken: string,
  eventId: number,
): Promise<EventLogRow> {
  return getJson(source, `/${eventId}`, accessToken);
}

export async function fetchEventTypes(
  source: EventLogSource,
  accessToken: string,
): Promise<EventTypeRow[]> {
  const body = await getJson<{ results: EventTypeRow[] }>(source, '/types', accessToken);
  return body.results;
}

export function fetchEventRetention(
  source: EventLogSource,
  accessToken: string,
): Promise<EventRetentionStatus> {
  return getJson(source, '/retention', accessToken);
}

export function isFailureEvent(row: Pick<EventLogRow, 'event_type'>): boolean {
  return row.event_type === LOGIN_FAILED || row.event_type.endsWith('.failed');
}

/** One-line summary of an event payload for tables. */
export function eventSummary(row: EventLogRow): string {
  const d = row.data;
  const text = (key: string) => (typeof d[key] === 'string' ? (d[key] as string) : '');
  const join = (...parts: string[]) => parts.filter(Boolean).join(' · ');
  if (row.event_type === LOGIN_SUCCEEDED || row.event_type === LOGIN_FAILED) {
    return join(text('provider'), text('failure_reason'));
  }
  if (row.event_type.startsWith('storage.')) {
    return text('path') || text('bucket_name');
  }
  if (row.event_type.startsWith('hosting.')) {
    const version = text('app_version');
    return join(text('display_name') || text('name'), version && `v${version}`, text('error'));
  }
  return text('display_name') || text('name') || text('email') || text('source');
}
