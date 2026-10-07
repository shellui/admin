import { describe, expect, it } from 'vitest';
import { normalizeImageSrc } from '@/features/email/editor/EmailImageMenu';

const ASSETS = 'http://localhost:8003/static/library';

describe('normalizeImageSrc', () => {
  it('keeps https URLs and library assets', () => {
    expect(normalizeImageSrc(' https://cdn.acme.com/logo.png ', ASSETS)).toBe(
      'https://cdn.acme.com/logo.png',
    );
    expect(normalizeImageSrc(`${ASSETS}/studio/logo.png`, ASSETS)).toBe(
      `${ASSETS}/studio/logo.png`,
    );
    expect(normalizeImageSrc('{{ system.assets_url }}/studio/logo.png', ASSETS)).toBe(
      `${ASSETS}/studio/logo.png`,
    );
  });

  it('adds https to a bare domain and allows an empty source', () => {
    expect(normalizeImageSrc('acme.com/logo.png', ASSETS)).toBe('https://acme.com/logo.png');
    expect(normalizeImageSrc('  ', ASSETS)).toBe('');
  });

  it('refuses sources email-service would reject', () => {
    expect(normalizeImageSrc('http://acme.com/logo.png', ASSETS)).toBeNull();
    expect(normalizeImageSrc('data:image/png;base64,AAAA', ASSETS)).toBeNull();
    expect(normalizeImageSrc('{{ logo_url }}', ASSETS)).toBeNull();
  });
});
