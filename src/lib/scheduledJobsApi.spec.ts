import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import {
  SCHEDULED_JOB_COUNT_KEYS,
  SCHEDULED_JOB_ERROR_KEYS,
  SCHEDULED_JOB_HEALTH,
  SCHEDULED_JOB_NAMES,
  SCHEDULED_JOB_RUN_STATUSES,
  ScheduledJobsForbiddenError,
  errorLabelKey,
  fetchScheduledJobRun,
  fetchScheduledJobRuns,
  fetchScheduledJobs,
  formatDurationMs,
  formatRelativeTime,
  healthLabelKey,
  jobLabelKey,
  orderedCounts,
  runStatusLabelKey,
  secondsSince,
} from '@/lib/scheduledJobsApi';

const BASE = 'https://identity.test';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scheduled jobs API client', () => {
  it('calls the documented endpoints with the bearer token', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse(200, { results: [{ id: 1 }] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchScheduledJobs('tok', BASE);
    const runs = await fetchScheduledJobRuns('tok', 'retry_webhooks', 5, BASE);
    await fetchScheduledJobRun('tok', 42, BASE);

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toBe(`${BASE}/api/v1/scheduled-jobs`);
    expect(urls[1]).toBe(`${BASE}/api/v1/scheduled-jobs/retry_webhooks/runs?limit=5`);
    expect(urls[2]).toBe(`${BASE}/api/v1/scheduled-jobs/runs/42`);
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok');
    expect(runs).toEqual([{ id: 1 }]);
  });

  it.each([401, 403])('maps %i to ScheduledJobsForbiddenError', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(status, { detail: 'Staff only.' })),
    );
    await expect(fetchScheduledJobs('tok', BASE)).rejects.toBeInstanceOf(
      ScheduledJobsForbiddenError,
    );
  });

  it('throws a plain error for other failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(500, { detail: 'boom' })),
    );
    const err = await fetchScheduledJobs('tok', BASE).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ScheduledJobsForbiddenError);
    expect((err as Error).message).toBe('boom');
  });
});

describe('label keys', () => {
  it('maps known API values and falls back for unknown ones', () => {
    expect(healthLabelKey('overdue')).toBe('scheduledJobsHealth_overdue');
    expect(healthLabelKey('weird')).toBe('scheduledJobsHealth_unknown');
    expect(runStatusLabelKey('skipped_locked')).toBe('scheduledJobsRunStatus_skipped_locked');
    expect(runStatusLabelKey('x')).toBe('scheduledJobsRunStatus_unknown');
    expect(errorLabelKey(null)).toBeNull();
    expect(errorLabelKey('redis_error')).toBe('scheduledJobsError_redis_error');
    expect(errorLabelKey('new_key')).toBe('scheduledJobsError_unexpected_error');
    expect(jobLabelKey('purge_expired_data')).toBe('scheduledJobsJob_purge_expired_data');
    expect(jobLabelKey('other')).toBe('scheduledJobsJob_unknown');
  });

  it('has an EN and FR translation for every API value', () => {
    const keys = [
      ...SCHEDULED_JOB_HEALTH.map((h) => `scheduledJobsHealth_${h}`),
      ...SCHEDULED_JOB_RUN_STATUSES.map((s) => `scheduledJobsRunStatus_${s}`),
      ...SCHEDULED_JOB_ERROR_KEYS.map((k) => `scheduledJobsError_${k}`),
      ...SCHEDULED_JOB_NAMES.map((j) => `scheduledJobsJob_${j}`),
      ...SCHEDULED_JOB_NAMES.map((j) => `scheduledJobsJobDescription_${j}`),
      ...Object.values(SCHEDULED_JOB_COUNT_KEYS)
        .flat()
        .map((k) => `scheduledJobsCount_${k}`),
      'scheduledJobsTrigger_celery',
      'scheduledJobsTrigger_command',
    ];
    for (const lng of ['en', 'fr']) {
      for (const key of keys) {
        expect(i18n.exists(key, { lng }), `${lng}:${key}`).toBe(true);
      }
    }
  });

  it('keeps em and en dashes out of the new strings', () => {
    for (const lng of ['en', 'fr']) {
      const bundle = i18n.getResourceBundle(lng, 'translation') as Record<string, string>;
      for (const [key, value] of Object.entries(bundle)) {
        if (!key.startsWith('scheduledJobs') && !key.startsWith('actionsAttempt')) continue;
        expect(value, `${lng}:${key}`).not.toMatch(/[\u2013\u2014]/);
      }
    }
  });
});

describe('formatting helpers', () => {
  it('orders counts by the known keys and drops non numeric values', () => {
    expect(
      orderedCounts('purge_expired_data', {
        scheduled_job_runs: 3,
        events: 10,
        complete: true,
        extra: 1,
      }),
    ).toEqual([
      { key: 'events', value: 10 },
      { key: 'scheduled_job_runs', value: 3 },
      { key: 'extra', value: 1 },
    ]);
    expect(orderedCounts('retry_webhooks', null)).toEqual([]);
  });

  it('formats relative times and durations', () => {
    const now = Date.parse('2026-10-06T12:00:00Z');
    expect(secondsSince('2026-10-06T11:58:00Z', now)).toBe(120);
    expect(secondsSince(null, now)).toBeNull();
    expect(formatRelativeTime('2026-10-06T11:58:00Z', 'en', now)).toBe('2 minutes ago');
    expect(formatRelativeTime('2026-10-06T13:00:00Z', 'en', now)).toBe('in 1 hour');
    expect(formatRelativeTime('bad', 'en', now)).toBeNull();
    expect(formatDurationMs(250, 'en')).toBe('250 ms');
    expect(formatDurationMs(1530, 'en')).toBe('1.5 sec');
    expect(formatDurationMs(null, 'en')).toBeNull();
  });
});
