import { describe, expect, it } from 'vitest';
import {
  buildButtonInlineStyle,
  buildCtaButtonHtml,
  DEFAULT_EMAIL_STYLE,
  normalizeHexColor,
  updateCtaButtonStylesInHtml,
} from '@/lib/emailStyle';

describe('emailStyle', () => {
  it('normalizeHexColor accepts hash and bare hex', () => {
    expect(normalizeHexColor('#AABBCC', '#000000')).toBe('#aabbcc');
    expect(normalizeHexColor('112233', '#000000')).toBe('#112233');
    expect(normalizeHexColor('nope', '#000000')).toBe('#000000');
  });

  it('buildCtaButtonHtml embeds brand color in inline style', () => {
    const html = buildCtaButtonHtml('https://example.com', 'Sign in', {
      ...DEFAULT_EMAIL_STYLE,
      brandColor: '#0ea5e9',
    });
    expect(html).toContain('background:#0ea5e9');
    expect(html).toContain('href="https://example.com"');
  });

  it('updateCtaButtonStylesInHtml updates CTA anchors only', () => {
    const input =
      '<p><a href="{{ data.magic_link_url }}" style="display:inline-block;padding:8px;background:#2563eb;color:#fff;">Go</a></p>' +
      '<p><a href="https://x.com" style="color:#2563eb;text-decoration:underline;">Link</a></p>';
    const out = updateCtaButtonStylesInHtml(input, {
      ...DEFAULT_EMAIL_STYLE,
      brandColor: '#dc2626',
      buttonTextColor: '#ffffff',
    });
    expect(out).toContain('background:#dc2626');
    expect(out).toContain('{{ data.magic_link_url }}');
    expect(out).toContain('Go</a>');
    expect(out).toMatch(/underline.*Link/);
  });

  it('buildButtonInlineStyle includes radius', () => {
    expect(buildButtonInlineStyle({ ...DEFAULT_EMAIL_STYLE, borderRadiusPx: 12 })).toContain(
      'border-radius:12px',
    );
  });
});
