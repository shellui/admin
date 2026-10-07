import type { CSSProperties } from 'react';
import type { Appearance, SettingsAvailableTheme } from '@shellui/sdk';
import type { EmailDocument } from '@/lib/emailDocument';

/**
 * Shellui themes for library designs. email-service rewrites a design's colors
 * to `var(--email-<role>,<color>)`: the canvas repaints by setting those
 * variables, and composing replaces them, as `apps.email.theming` does.
 */
export const EMAIL_THEME_ROLES = [
  'background',
  'foreground',
  'card',
  'muted',
  'muted_foreground',
  'primary',
  'primary_foreground',
  'border',
] as const;

export type EmailThemeRole = (typeof EMAIL_THEME_ROLES)[number];

export type EmailThemeColors = Partial<Record<EmailThemeRole, string>>;

/** Hex colors per role. `null` where used keeps the design's own colors. */
export type EmailTheme = { name: string; label: string; colors: EmailThemeColors };

type ShelluiTheme = Pick<SettingsAvailableTheme, 'name' | 'displayName' | 'colors'>;

const SOURCE_KEYS: Record<EmailThemeRole, keyof SettingsAvailableTheme['colors']['light']> = {
  background: 'background',
  foreground: 'foreground',
  card: 'card',
  muted: 'muted',
  muted_foreground: 'mutedForeground',
  primary: 'primary',
  primary_foreground: 'primaryForeground',
  border: 'border',
};

const VARIABLE = /var\(--email-([a-z-]+)\s*,\s*([^()]*(?:\([^()]*\))?[^()]*)\)/g;
const HSL_CHANNELS = /^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/;
const FUNCTION = /^(rgba?|hsla?|oklch)\(\s*([^)]*)\)$/i;

type Rgba = [number, number, number, number];

function channel(raw: string, scale: number): number {
  return raw.endsWith('%') ? (parseFloat(raw) / 100) * scale : parseFloat(raw);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + (((h % 360) + 360) % 360) / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function oklchToRgb(lightness: number, chroma: number, hue: number): [number, number, number] {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((x) => {
    const v = Math.min(1, Math.max(0, x));
    return (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255;
  }) as [number, number, number];
}

function parseColor(value: string): Rgba | null {
  let raw = value.trim();
  if (HSL_CHANNELS.test(raw)) raw = `hsl(${raw})`;
  const hex = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(raw)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const [r, g, b, a = 255] = full.match(/../g)!.map((pair) => parseInt(pair, 16));
    return [r, g, b, a / 255];
  }
  const match = FUNCTION.exec(raw);
  if (!match) return null;
  const [main, alphaPart] = match[2].split('/');
  const parts = main.trim().split(/[\s,]+/);
  const commaAlpha = parts.length === 4 ? parts.pop() : undefined;
  if (parts.length !== 3) return null;
  const alphaRaw = (alphaPart ?? commaAlpha)?.trim();
  const alpha = alphaRaw ? channel(alphaRaw, 1) : 1;
  const kind = match[1].toLowerCase();
  let rgb: [number, number, number];
  if (kind.startsWith('rgb')) {
    rgb = parts.map((part) => channel(part, 255)) as [number, number, number];
  } else if (kind.startsWith('hsl')) {
    rgb = hslToRgb(parseFloat(parts[0]), parseFloat(parts[1]) / 100, parseFloat(parts[2]) / 100);
  } else {
    rgb = oklchToRgb(channel(parts[0], 1), channel(parts[1], 0.4), parseFloat(parts[2]) || 0);
  }
  if ([...rgb, alpha].some((n) => Number.isNaN(n))) return null;
  return [...rgb, Math.min(1, Math.max(0, alpha))];
}

/** Any CSS color a Shellui theme uses (hex, rgb, hsl or bare HSL channels, oklch) as `#rrggbb`. Translucent colors sit on `backdrop`. */
export function cssColorToHex(value: string, backdrop = '#ffffff'): string | null {
  const color = parseColor(value);
  if (!color) return null;
  const [r, g, b, a] = color;
  const under = a < 1 ? (parseColor(backdrop) ?? [255, 255, 255, 1]) : [0, 0, 0, 1];
  return `#${[r, g, b]
    .map((v, i) => Math.round(v * a + under[i] * (1 - a)))
    .map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** The theme's light colors, as the email roles. Null when none converts. */
export function emailThemeFrom(theme: ShelluiTheme): EmailTheme | null {
  const mode = theme.colors?.light;
  if (!mode) return null;
  const background = cssColorToHex(mode.background ?? '') ?? '#ffffff';
  const colors: EmailThemeColors = {};
  for (const role of EMAIL_THEME_ROLES) {
    const hex = cssColorToHex(mode[SOURCE_KEYS[role]] ?? '', background);
    if (hex) colors[role] = hex;
  }
  if (!Object.keys(colors).length) return null;
  return { name: theme.name, label: theme.displayName || theme.name, colors };
}

/** Every theme of Settings > Appearance, and the one the user has selected. */
export function shelluiEmailThemes(appearance: Appearance | null): {
  themes: EmailTheme[];
  current: EmailTheme | null;
} {
  if (!appearance) return { themes: [], current: null };
  const current = emailThemeFrom(appearance);
  const themes: EmailTheme[] = [];
  for (const item of appearance.availableThemes ?? []) {
    const theme = item.name === appearance.name && current ? current : emailThemeFrom(item);
    if (theme && !themes.some((other) => other.name === theme.name)) themes.push(theme);
  }
  if (current && !themes.some((theme) => theme.name === current.name)) themes.unshift(current);
  return { themes, current };
}

export function emailThemeVariable(role: EmailThemeRole): string {
  return `--email-${role.replaceAll('_', '-')}`;
}

/** The canvas style that repaints a tokenized design. */
export function emailThemeStyle(colors: EmailThemeColors | undefined): CSSProperties {
  return Object.fromEntries(
    Object.entries(colors ?? {}).map(([role, color]) => [
      emailThemeVariable(role as EmailThemeRole),
      color,
    ]),
  ) as CSSProperties;
}

/** `value` with each theme variable replaced by the theme's color, or the design's own. */
export function resolveEmailTheme<T>(value: T, colors: EmailThemeColors | undefined): T {
  if (typeof value === 'string') {
    if (!value.includes('var(--email-')) return value;
    return value.replace(
      VARIABLE,
      (_match, role: string, fallback: string) =>
        colors?.[role.replaceAll('-', '_') as EmailThemeRole] || fallback.trim(),
    ) as T;
  }
  if (Array.isArray(value)) return value.map((item) => resolveEmailTheme(item, colors)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveEmailTheme(item, colors)]),
    ) as T;
  }
  return value;
}

/** A stored theme, or null for `{}` and anything malformed. */
export function parseEmailTheme(raw: unknown): EmailTheme | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.name !== 'string' || !row.name || !row.colors || typeof row.colors !== 'object') {
    return null;
  }
  const colors: EmailThemeColors = {};
  for (const role of EMAIL_THEME_ROLES) {
    const value = (row.colors as Record<string, unknown>)[role];
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) colors[role] = value;
  }
  if (!Object.keys(colors).length) return null;
  return {
    name: row.name,
    label: typeof row.label === 'string' && row.label ? row.label : row.name,
    colors,
  };
}

/** The design's own color for each role it uses, as written in the document. Empty when a theme cannot repaint it. */
export function emailDesignColors(document: EmailDocument): EmailThemeColors {
  const colors: EmailThemeColors = {};
  for (const match of JSON.stringify(document).matchAll(VARIABLE)) {
    const role = match[1].replaceAll('-', '_') as EmailThemeRole;
    if (EMAIL_THEME_ROLES.includes(role) && !colors[role]) colors[role] = match[2].trim();
  }
  return colors;
}
