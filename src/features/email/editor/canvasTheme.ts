import type { CSSProperties } from 'react';
import { resolveColors, type TemplateSpec } from '@/features/email/templates/vendor/email.mjs';

function value(spec: TemplateSpec, key: string, fallback: string): string {
  const raw = spec[key];
  return typeof raw === 'string' && raw ? raw : fallback;
}

/**
 * CSS variables that make the editor canvas look like the rendered email.
 * Same layout rules as `_python_html` in email-service apps/email/rendering.py.
 */
export function canvasVariables(
  spec: TemplateSpec,
  palette: Record<string, string> | null,
): CSSProperties {
  const colors = resolveColors(spec, palette);
  const layout = value(spec, 'layout', 'card');
  const outline = spec.button_style === 'outline';
  const serifOutline = outline && layout === 'serif';
  const shadow = value(spec, 'shadow', 'none');
  const radius = value(spec, 'card_radius', '0');
  return {
    '--email-page': colors.muted,
    '--email-card': colors.background,
    '--email-inner': layout === 'inset' ? colors.inner : colors.background,
    '--email-foreground': colors.foreground,
    '--email-body': colors.body,
    '--email-muted': colors.mutedForeground,
    '--email-primary': colors.primary,
    '--email-border-color': colors.border,
    '--email-card-border':
      layout === 'card' || layout === 'inset' ? `1px solid ${colors.border}` : '0',
    '--email-card-radius': radius,
    '--email-frame': layout === 'inset' ? '16px' : '0',
    '--email-inner-radius': layout === 'inset' ? '8px' : radius,
    '--email-card-shadow': shadow,
    '--email-max-width': value(spec, 'max_width', '640px'),
    '--email-pad': layout === 'inset' ? '28px 24px' : '40px 32px',
    '--email-align': value(spec, 'align', 'left'),
    '--email-font': spec.font,
    '--email-heading-font': spec.heading_font,
    '--email-heading-size': value(spec, 'heading_size', '32px'),
    '--email-heading-weight': value(spec, 'heading_weight', '600'),
    '--email-heading-transform': value(spec, 'heading_transform', 'none'),
    '--email-text-size': value(spec, 'text_size', '16px'),
    '--email-button-bg': serifOutline ? 'transparent' : colors.primary,
    '--email-button-fg': serifOutline ? colors.foreground : colors.primaryForeground,
    '--email-button-border': serifOutline
      ? `1px solid ${colors.foreground}`
      : outline
        ? `1px solid ${colors.border}`
        : '0',
    '--email-button-radius': value(spec, 'button_radius', '0'),
    '--email-button-pad': value(spec, 'button_pad', '12px 20px'),
    '--email-button-shadow': outline ? shadow : 'none',
  } as CSSProperties;
}

export function canvasLayout(spec: TemplateSpec): string {
  return value(spec, 'layout', 'card');
}

/** `@font-face` rules for the template web fonts. */
export function fontFaceCss(spec: TemplateSpec): string {
  return (spec.fonts ?? [])
    .map((font) => {
      const family = font.family.replace(/['\\]/g, '');
      const url = font.url.replace(/['\\]/g, '');
      return (
        `@font-face{font-family:'${family}';font-style:normal;font-weight:${Number(font.weight) || 400};` +
        `src:url('${url}') format('${font.format || 'woff2'}');font-display:swap;}`
      );
    })
    .join('');
}
