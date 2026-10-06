import { describe, expect, it } from 'vitest';
import { parseDeliveryDetail } from '@/lib/actionsApiParsers';

describe('parseDeliveryDetail attempts', () => {
  it('keeps the identity attempt trigger and the staff-only scheduled job run id', () => {
    const detail = parseDeliveryDetail({
      id: 'd1',
      status: 'delivered',
      attempts: [
        { id: 1, status: 'failure', http_status: 500, trigger: 'dispatch' },
        {
          id: 2,
          status: 'success',
          http_status: 200,
          trigger: 'automatic_retry',
          scheduled_job_run_id: 42,
        },
        { id: 3, status: 'success', trigger: null },
      ],
    });
    expect(detail.attempts.map((a) => [a.trigger, a.scheduled_job_run_id])).toEqual([
      ['dispatch', null],
      ['automatic_retry', 42],
      [null, null],
    ]);
  });
});
