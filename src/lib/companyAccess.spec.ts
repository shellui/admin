import { describe, expect, it } from 'vitest';

/** Mirrors domain parsing used by DashboardCompanySection. */
function parseDomains(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, '').replace(/\.$/, ''))
    .filter(Boolean);
}

describe('parseDomains', () => {
  it('splits and normalizes domains', () => {
    expect(parseDomains('@Acme.COM, other.io; foo.org.')).toEqual([
      'acme.com',
      'other.io',
      'foo.org',
    ]);
  });

  it('returns empty for blank input', () => {
    expect(parseDomains('  , ; ')).toEqual([]);
  });
});
