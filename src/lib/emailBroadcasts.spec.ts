import { describe, expect, it } from 'vitest';
import {
  parseAudience,
  parseBroadcast,
  parseBroadcastPreview,
  parsePastedEmails,
  senderOnSubdomain,
} from '@/lib/emailBroadcasts';

describe('emailBroadcasts', () => {
  it('parses a sent broadcast with counts and a sender', () => {
    const broadcast = parseBroadcast({
      id: 4,
      name: 'October news',
      state: 'sent',
      delivery: 'resend',
      from_email: 'news@news.acme.com',
      template_id: 9,
      template_version: 2,
      language: 'fr',
      audience: { mode: 'filter', roles: ['member', 'admin'], access: 'weird', group_ids: [3, -1] },
      counts: { total: 5, sent: 3, skipped_unsubscribed: 2 },
      last_error_code: '',
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-01T10:05:00Z',
      sent_at: '2026-10-01T10:05:00Z',
      sender: {
        from_email: 'news@news.acme.com',
        from_name: 'Acme',
        delivery: 'resend',
        error_code: '',
      },
    });
    expect(broadcast.state).toBe('sent');
    expect(broadcast.language).toBe('fr');
    expect(broadcast.audience.roles).toEqual(['member']);
    expect(broadcast.audience.access).toBe('enabled');
    expect(broadcast.audience.group_ids).toEqual([3]);
    expect(broadcast.counts?.total).toBe(5);
    expect(broadcast.counts?.delivered).toBe(0);
    expect(broadcast.counts?.skipped_unsubscribed).toBe(2);
    expect(broadcast.sender?.delivery).toBe('resend');
  });

  it('leaves counts empty for a draft and defaults the audience', () => {
    const broadcast = parseBroadcast({ id: 1, name: 'Draft', state: 'draft', counts: null });
    expect(broadcast.counts).toBeNull();
    expect(broadcast.sender).toBeNull();
    expect(parseAudience(undefined)).toEqual(broadcast.audience);
    expect(broadcast.audience.mode).toBe('filter');
  });

  it('parses a preview per language', () => {
    expect(
      parseBroadcastPreview({
        total: 6,
        sendable: 4,
        unsubscribed: 1,
        suppressed: 1,
        languages: { en: 3, fr: 1 },
        samples: ['a***@acme.com'],
      }),
    ).toEqual({
      total: 6,
      sendable: 4,
      unsubscribed: 1,
      suppressed: 1,
      languages: { en: 3, fr: 1 },
      samples: ['a***@acme.com'],
    });
  });

  it('splits pasted addresses and drops duplicates', () => {
    expect(parsePastedEmails('ada@acme.com, grace@acme.com\nADA@acme.com; nope')).toEqual({
      emails: ['ada@acme.com', 'grace@acme.com'],
      invalid: ['nope'],
    });
  });

  it('tells a subdomain sender apart', () => {
    expect(senderOnSubdomain('news@news.acme.com')).toBe(true);
    expect(senderOnSubdomain('hello@acme.com')).toBe(false);
  });
});
