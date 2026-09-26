export type EmailStylePrefs = {
  brandColor: string;
  buttonTextColor: string;
  borderRadiusPx: number;
  pageBackground: string;
  contentWidthPx: number;
  layout: 'flat' | 'card';
  linkUsesBrandColor: boolean;
};

export type EmailPreviewWrapOptions = Pick<
  EmailStylePrefs,
  'pageBackground' | 'contentWidthPx' | 'layout'
>;

export const DEFAULT_EMAIL_STYLE: EmailStylePrefs = {
  brandColor: '#2563eb',
  buttonTextColor: '#ffffff',
  borderRadiusPx: 6,
  pageBackground: '#f3f4f6',
  contentWidthPx: 560,
  layout: 'flat',
  linkUsesBrandColor: true,
};

export function normalizeHexColor(input: string, fallback: string): string {
  const trimmed = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return fallback;
}

export function buildButtonInlineStyle(prefs: EmailStylePrefs): string {
  return [
    'display:inline-block',
    'padding:10px 16px',
    `background:${prefs.brandColor}`,
    `color:${prefs.buttonTextColor}`,
    'text-decoration:none',
    `border-radius:${prefs.borderRadiusPx}px`,
    'font-weight:600',
  ].join(';');
}

export function buildTextLinkInlineStyle(prefs: EmailStylePrefs): string {
  return `color:${prefs.brandColor};text-decoration:underline;`;
}

export function buildCtaButtonHtml(href: string, label: string, prefs: EmailStylePrefs): string {
  const style = buildButtonInlineStyle(prefs);
  return `<p><a href="${href}" style="${style}">${label}</a></p>`;
}

export function looksLikeEmailCtaAnchor(styleOrHtml: string): boolean {
  return /display\s*:\s*inline-block/i.test(styleOrHtml) && /padding/i.test(styleOrHtml);
}

/** Update inline styles on existing CTA-style anchors without changing href or inner HTML. */
export function updateCtaButtonStylesInHtml(html: string, prefs: EmailStylePrefs): string {
  const nextStyle = buildButtonInlineStyle(prefs);
  return html.replace(/<a\b([^>]*)>/gi, (match, attrs: string) => {
    const styleMatch = /style="([^"]*)"/i.exec(attrs);
    const styleValue = styleMatch?.[1] ?? '';
    if (!looksLikeEmailCtaAnchor(styleValue || match)) return match;
    if (styleMatch) {
      return `<a${attrs.replace(/style="[^"]*"/i, `style="${nextStyle}"`)}>`;
    }
    return `<a style="${nextStyle}"${attrs}>`;
  });
}
