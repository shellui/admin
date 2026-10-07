import { describe, expect, it } from 'vitest';
import { parseAudience } from '@/lib/emailBroadcasts';
import {
  newsletterFormSnippet,
  parseImportResult,
  parseNewsletter,
  parseOrigins,
  parseSubscriberPage,
} from '@/lib/emailNewsletters';

describe('emailNewsletters', () => {
  it('parses a list with counts and its sender', () => {
    const newsletter = parseNewsletter({
      id: 3,
      name: 'Product news',
      public_key: 'nl_abc',
      default_language: 'fr',
      allowed_origins: ['https://shellui.com', 4],
      turnstile_configured: true,
      confirmation_template_id: 12,
      subscribe_url: 'https://email.shellui.com/api/v1/public/newsletters/nl_abc/subscribe',
      counts: { confirmed: 8, pending: 2 },
      sender: { from_email: 'hello@acme.com', error_code: '' },
    });
    expect(newsletter.allowedOrigins).toEqual(['https://shellui.com']);
    expect(newsletter.counts).toEqual({ pending: 2, confirmed: 8, unsubscribed: 0 });
    expect(newsletter.turnstileConfigured).toBe(true);
    expect(newsletter.sender).toEqual({ fromEmail: 'hello@acme.com', errorCode: '' });
    expect(parseNewsletter({ id: 4 }).sender).toBeNull();
    expect(() => parseNewsletter({ name: 'x' })).toThrow();
  });

  it('parses a subscriber page and an import result', () => {
    const page = parseSubscriberPage({
      count: 1,
      page: 1,
      page_size: 50,
      results: [{ id: 1, email: 'ada@example.org', status: 'weird', source: 'import' }],
    });
    expect(page.results[0]).toMatchObject({
      email: 'ada@example.org',
      status: 'pending',
      source: 'import',
    });
    expect(parseImportResult({ added: 2, skipped_suppressed: 1 })).toEqual({
      added: 2,
      existing: 0,
      invalid: 0,
      skippedUnsubscribed: 0,
      skippedSuppressed: 1,
    });
  });

  it('reads a newsletter audience', () => {
    expect(parseAudience({ mode: 'newsletter', list_id: 3 })).toMatchObject({
      mode: 'newsletter',
      list_id: 3,
    });
    expect(parseAudience({ mode: 'newsletter' }).mode).toBe('filter');
  });

  it('keeps the origin of each website', () => {
    expect(parseOrigins('https://shellui.com/\nhttps://www.shellui.com/path, nope')).toEqual({
      origins: ['https://shellui.com', 'https://www.shellui.com'],
      invalid: ['nope'],
    });
  });

  it('builds a form that posts to the list', () => {
    const plain = newsletterFormSnippet({
      subscribeUrl: 'https://e.test/sub',
      turnstileSiteKey: '',
    });
    expect(plain).toContain('fetch("https://e.test/sub"');
    expect(plain).toContain('name="website"');
    expect(plain).not.toContain('turnstile');
    const guarded = newsletterFormSnippet({
      subscribeUrl: 'https://e.test/sub',
      turnstileSiteKey: '0x4A',
    });
    expect(guarded).toContain('data-sitekey="0x4A"');
  });
});
