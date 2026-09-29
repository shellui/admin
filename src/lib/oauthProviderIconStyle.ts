/** Relative luminance (sRGB) for a 6-digit hex color without #. */
export function relativeLuminanceFromHex(hex: string): number {
  const normalized = hex.replace(/^#/, '').trim();
  if (normalized.length !== 6) return 0.5;
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const transform = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = transform(r);
  const G = transform(g);
  const B = transform(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function shouldUseBrandIconColor(
  hex: string | undefined,
  colorScheme: 'light' | 'dark',
): boolean {
  if (!hex || !hex.trim()) return false;
  const lum = relativeLuminanceFromHex(hex);
  if (colorScheme === 'dark') return lum >= 0.45;
  return lum <= 0.55;
}

export function protocolUsesKeyRoundFallback(protocol: string, docsSlug: string): boolean {
  const p = protocol.toLowerCase();
  const slug = docsSlug.toLowerCase();
  if (slug.includes('saml') || slug.includes('openid') || slug === 'oauth2') return true;
  return p.includes('saml') || p.includes('openid') || p === 'oauth2';
}
