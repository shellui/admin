import DOMPurify from 'isomorphic-dompurify';
import type { EmailPreviewWrapOptions } from '@/lib/emailStyle';

/** Email-safe subset aligned with TipTap StarterKit + links, buttons, basic tables/images. */
export const EMAIL_HTML_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'span',
  'div',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'img',
] as const;

export const EMAIL_HTML_ALLOWED_ATTR = [
  'href',
  'src',
  'alt',
  'style',
  'target',
  'rel',
  'width',
  'height',
  'align',
  'border',
  'cellpadding',
  'cellspacing',
] as const;

const FORBIDDEN_URI_SCHEME = /^(?:javascript|data|vbscript):/i;

function collapseUriForSchemeCheck(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

/** Allow http(s), mailto, fragment, path-relative, and other scheme-less relative URLs. */
export function isAllowedEmailUri(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const collapsed = collapseUriForSchemeCheck(trimmed);
  if (FORBIDDEN_URI_SCHEME.test(collapsed.toLowerCase())) return false;
  if (/^https?:\/\//i.test(collapsed)) return true;
  if (/^mailto:/i.test(collapsed)) return true;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('/')) return true;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return true;
  return false;
}

let emailSanitizerHooksInstalled = false;

function ensureEmailSanitizerHooks(): void {
  if (emailSanitizerHooksInstalled) return;
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'href' || data.attrName === 'src') {
      if (!isAllowedEmailUri(data.attrValue)) {
        data.keepAttr = false;
      }
    }
  });
  emailSanitizerHooksInstalled = true;
}

/**
 * Sanitize TipTap HTML for email preview and export using an allowlisted DOM sanitizer.
 */
export function sanitizeEmailHtmlFragment(html: string): string {
  ensureEmailSanitizerHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...EMAIL_HTML_ALLOWED_TAGS],
    ALLOWED_ATTR: [...EMAIL_HTML_ALLOWED_ATTR],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Wrap sanitized body HTML in a minimal email-safe document with inline-friendly defaults.
 * Exported HTML must not depend on external CSS or JS.
 */
export function wrapEmailBodyHtml(
  bodyInnerHtml: string,
  preview?: EmailPreviewWrapOptions,
): string {
  const inner = sanitizeEmailHtmlFragment(bodyInnerHtml.trim()) || '<p></p>';
  const width = preview?.contentWidthPx ?? 560;
  const pageBg = preview?.pageBackground ?? '#f3f4f6';
  const card = preview?.layout === 'card';
  const contentWrap = card
    ? `<div style="max-width:${width}px;margin:0 auto;background:#ffffff;padding:24px;border-radius:8px;border:1px solid #e5e7eb;">${inner}</div>`
    : `<div style="max-width:${width}px;margin:0 auto;">${inner}</div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Email preview</title>
</head>
<body style="margin:0;padding:16px;background:${pageBg};font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
${contentWrap}
</body>
</html>`;
}

export function exportEditorHtmlToEmailFragment(html: string): string {
  return sanitizeEmailHtmlFragment(html);
}

export function exportEditorHtmlToStandaloneDocument(
  html: string,
  preview?: EmailPreviewWrapOptions,
): string {
  return wrapEmailBodyHtml(html, preview);
}
