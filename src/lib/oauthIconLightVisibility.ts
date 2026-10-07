import { auditSvgMarkupIds } from '@/lib/oauthSvgIds';

const SHAPE_TAGS = new Set(['path', 'circle', 'rect', 'ellipse', 'polygon', 'polyline']);
const WHITE_FILL = new Set(['#fff', '#ffffff', 'white', '#fefefe', '#fafafa']);

function normalizeHex(color: string): string {
  return color.trim().toLowerCase();
}

function isWhiteFill(fill: string): boolean {
  const f = normalizeHex(fill);
  if (WHITE_FILL.has(f)) return true;
  if (/^#[0-9a-f]{3}$/i.test(f)) {
    const expanded = `#${f[1]}${f[1]}${f[2]}${f[2]}${f[3]}${f[3]}`.toLowerCase();
    return WHITE_FILL.has(expanded);
  }
  return false;
}

const GRADIENT_TAGS = new Set(['lineargradient', 'radialgradient']);

function gradientStopRoot(doc: Document, gradientId: string): Element | null {
  let el = doc.getElementById(gradientId);
  if (!el) return null;
  for (let depth = 0; depth < 8; depth += 1) {
    if (el.querySelector(':scope > stop')) return el;
    const href =
      el.getAttribute('href') ||
      el.getAttribute('xlink:href') ||
      el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    if (!href?.startsWith('#')) break;
    const target = doc.getElementById(href.slice(1));
    if (!target || target === el) break;
    el = target;
  }
  return el;
}

function gradientHasNonWhiteStop(doc: Document, gradientId: string): boolean {
  const el = gradientStopRoot(doc, gradientId);
  if (!el) return false;
  const tag = el.localName?.toLowerCase() ?? '';
  if (!GRADIENT_TAGS.has(tag)) return true;
  for (const stop of el.querySelectorAll('stop')) {
    const color =
      stop.getAttribute('stop-color') ||
      stop.getAttribute('style')?.match(/stop-color:\s*([^;]+)/)?.[1];
    if (!color) continue;
    if (!isWhiteFill(color)) return true;
  }
  return false;
}

export type SvgLightVisibilityAudit = {
  ok: boolean;
  issue?: string;
};

/**
 * Flags logos that would look invisible on a white tile: only white/currentColor fills
 * with no contrasting background shape or broken gradient reference.
 */
export function auditSvgMarkupLightVisibility(svgMarkup: string): SvgLightVisibilityAudit {
  const idAudit = auditSvgMarkupIds(svgMarkup);
  if (idAudit.brokenReferences.length > 0) {
    return {
      ok: false,
      issue: `broken paint references: ${idAudit.brokenReferences.join(', ')}`,
    };
  }

  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() === 'parsererror') {
    return { ok: false, issue: 'invalid svg markup' };
  }

  function effectiveFill(el: Element): string | null {
    let node: Element | null = el;
    while (node && node !== root) {
      const fill = node.getAttribute('fill');
      if (fill && fill !== 'none') return fill;
      node = node.parentElement;
    }
    return null;
  }

  let hasWhiteShape = false;
  let hasContrastingPaint = false;

  for (const shape of root.getElementsByTagName('*')) {
    if (!SHAPE_TAGS.has(shape.localName)) continue;
    const fill = effectiveFill(shape);
    if (!fill) continue;
    if (isWhiteFill(fill)) {
      hasWhiteShape = true;
      continue;
    }
    if (fill.trim() === 'currentColor') continue;
    if (fill.startsWith('url(#')) {
      const id = fill.slice(5, -1);
      if (gradientHasNonWhiteStop(doc, id)) hasContrastingPaint = true;
      continue;
    }
    hasContrastingPaint = true;
  }

  if (hasWhiteShape && !hasContrastingPaint) {
    return {
      ok: false,
      issue: 'only white or transparent fills with no contrasting background',
    };
  }

  return { ok: true };
}
