/**
 * URL helpers for the React Email action editor.
 *
 * Bubble menus use a strict URL parser that rejects `{{ data.magic_link_url }}`
 * and resets the href to `#`. We accept Mustache-style placeholders as valid
 * hrefs so send-time substitution can fill them in.
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** Mustache / Django-style `{{ token }}` (optional spaces). */
const TEMPLATE_PLACEHOLDER_RE = /^\{\{\s*[\w.-]+(?:\s*[\w.-]+)*\s*\}\}$/;

export function isActionEmailTemplatePlaceholder(value: string): boolean {
  return TEMPLATE_PLACEHOLDER_RE.test(value.trim());
}

/**
 * Same rules as @react-email/editor bubble-menu `getUrlFromString`, plus
 * template placeholders used in identity action emails.
 */
export function validateActionEmailUrl(value: string): string | null {
  const str = value.trim();
  if (!str) return null;
  if (str === '#') return str;
  if (isActionEmailTemplatePlaceholder(str)) return str;

  try {
    const url = new URL(str);
    if (SAFE_PROTOCOLS.has(url.protocol)) return str;
    return null;
  } catch {
    /* not an absolute URL */
  }

  try {
    if (str.includes('.') && !str.includes(' ')) {
      return new URL(`https://${str}`).toString();
    }
  } catch {
    /* ignore */
  }

  return null;
}

export function formatActionEmailPlaceholder(token: string): string {
  return `{{ ${token.trim()} }}`;
}
