import { describe, expect, it } from 'vitest';
import {
  exportEditorHtmlToStandaloneDocument,
  isAllowedEmailUri,
  sanitizeEmailHtmlFragment,
  wrapEmailBodyHtml,
} from '@/lib/emailHtmlExport';

describe('isAllowedEmailUri', () => {
  it('allows http(s), mailto, relative, and hash links', () => {
    expect(isAllowedEmailUri('https://example.com/path')).toBe(true);
    expect(isAllowedEmailUri('http://localhost/x')).toBe(true);
    expect(isAllowedEmailUri('mailto:user@example.com')).toBe(true);
    expect(isAllowedEmailUri('/relative/path')).toBe(true);
    expect(isAllowedEmailUri('#section')).toBe(true);
    expect(isAllowedEmailUri('page.html')).toBe(true);
  });

  it('blocks dangerous schemes', () => {
    expect(isAllowedEmailUri('javascript:alert(1)')).toBe(false);
    expect(isAllowedEmailUri('JavaScript:alert(1)')).toBe(false);
    expect(isAllowedEmailUri('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isAllowedEmailUri('vbscript:msgbox(1)')).toBe(false);
    expect(isAllowedEmailUri('java\nscript:alert(1)')).toBe(false);
  });
});

describe('emailHtmlExport', () => {
  it('wraps body in standalone document without external refs', () => {
    const doc = wrapEmailBodyHtml('<p>Hello</p>');
    expect(doc).toContain('<!DOCTYPE html>');
    expect(doc).toContain('<p>Hello</p>');
    expect(doc).not.toMatch(/<link\b/i);
    expect(doc).not.toMatch(/<script\b/i);
  });

  it('removes script tags including nested and broken end tags', () => {
    const clean = sanitizeEmailHtmlFragment(
      '<p>ok</p><script>evil()</script><scr<script>ipt>alert(1)</scr</script>ipt>',
    );
    expect(clean.toLowerCase()).not.toContain('<script');
    expect(clean).toContain('ok');
  });

  it('strips on* event handlers', () => {
    const clean = sanitizeEmailHtmlFragment(
      '<p onclick="alert(1)" onmouseover="x">x</p><a href="https://x.com" onfocus="y">link</a>',
    );
    expect(clean).not.toMatch(/\son\w+\s*=/i);
    expect(clean).toContain('href="https://x.com"');
    expect(clean).toContain('link');
  });

  it('strips javascript, data, and vbscript hrefs but keeps safe links', () => {
    const clean = sanitizeEmailHtmlFragment(
      [
        '<a href="javascript:alert(1)">bad</a>',
        '<a href="data:text/html,abc">data</a>',
        '<a href="vbscript:x">vbs</a>',
        '<a href="https://good.example/path">good</a>',
        '<strong>fmt</strong>',
      ].join(''),
    );
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('data:');
    expect(clean).not.toContain('vbscript:');
    expect(clean).toContain('href="https://good.example/path"');
    expect(clean).toContain('<strong>fmt</strong>');
  });

  it('exportEditorHtmlToStandaloneDocument sanitizes then wraps', () => {
    const doc = exportEditorHtmlToStandaloneDocument('<strong>Go</strong><script>x</script>');
    expect(doc).toContain('<strong>Go</strong>');
    expect(doc).toContain('font-family');
    expect(doc.toLowerCase()).not.toContain('<script');
  });
});
