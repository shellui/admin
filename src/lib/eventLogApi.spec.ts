import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  eventDetailPath,
  eventsListPath,
  eventSummary,
  fetchEventLog,
  isFailureEvent,
  type EventLogRow,
} from '@/lib/eventLogApi';

function row(event_type: string, data: Record<string, unknown>): EventLogRow {
  return {
    id: 1,
    company_id: 1,
    created_at: '2026-10-02T09:00:00Z',
    event_type,
    label: event_type,
    user_id: null,
    user_email: null,
    data,
  };
}

describe('eventLogApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['identity', 'https://id.example.com', 'https://id.example.com/api/v1/events?'],
    ['storage', 'https://st.example.com/', 'https://st.example.com/api/v1/actions/event-log?'],
    ['hosting', 'https://ho.example.com', 'https://ho.example.com/api/v1/actions/event-log?'],
  ] as const)('reads the %s event log without company_id', async (service, baseUrl, prefix) => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ count: 0, page: 1, page_size: 20, results: [] })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchEventLog({ service, baseUrl }, 'tok', { userId: 7, eventTypes: ['a', 'b'] });

    const url = String((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url.startsWith(prefix)).toBe(true);
    expect(url).toContain('user_id=7');
    expect(url).toContain('event_type=a%2Cb');
    expect(url).not.toContain('company_id');
  });

  it('builds service-relative routes', () => {
    expect(eventsListPath('identity')).toBe('/events');
    expect(eventDetailPath('storage', 4)).toBe('/storage/events/4');
    expect(eventDetailPath('hosting', 9)).toBe('/hosting/events/9');
  });

  it('flags failures and summarizes service payloads', () => {
    expect(isFailureEvent(row('identity.auth.login.failed', {}))).toBe(true);
    expect(isFailureEvent(row('hosting.deployment.failed', {}))).toBe(true);
    expect(isFailureEvent(row('hosting.deployment.succeeded', {}))).toBe(false);
    expect(eventSummary(row('storage.object.uploaded', { path: 'docs/a.pdf' }))).toBe('docs/a.pdf');
    expect(
      eventSummary(
        row('hosting.deployment.failed', {
          display_name: 'Docs',
          app_version: '1.2.0',
          error: 'artifact_extract_failed',
        }),
      ),
    ).toBe('Docs · v1.2.0 · artifact_extract_failed');
  });
});
