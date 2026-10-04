/**
 * Email templates and color themes.
 *
 * A template is the layout (the service still calls it `theme_name`).
 * A color theme is the seven-color `theme_palette` applied to that layout.
 */

export const EMAIL_THEME_KEYS = ['barebone', 'matte', 'protocol', 'arcane', 'studio'] as const;

export type EmailThemeKey = (typeof EMAIL_THEME_KEYS)[number];

export function isEmailThemeKey(value: string): value is EmailThemeKey {
  return (EMAIL_THEME_KEYS as readonly string[]).includes(value);
}

/** `shellui` and unknown names fall back to the company template, then Barebone. */
export function emailThemeKeyOrDefault(
  value: string | null | undefined,
  fallback: string,
): EmailThemeKey {
  if (value && isEmailThemeKey(value)) return value;
  if (isEmailThemeKey(fallback)) return fallback;
  return 'barebone';
}

export const PALETTE_KEYS = [
  'background',
  'foreground',
  'muted',
  'mutedForeground',
  'primary',
  'primaryForeground',
  'border',
] as const;

export type PaletteKey = (typeof PALETTE_KEYS)[number];

export type EmailPalette = Record<PaletteKey, string>;

/** `#RGB` or `#RRGGBB`. The service stores lowercase `#rrggbb` only. */
export function normalizePaletteColor(value: string): string | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1].toLowerCase();
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  return `#${hex}`;
}

/** All seven colors, or null when the palette is partial. Partial palettes are rejected. */
export function completeThemePalette(
  palette: Record<string, string> | null | undefined,
): EmailPalette | null {
  if (!palette) return null;
  const payload = {} as EmailPalette;
  for (const key of PALETTE_KEYS) {
    const color = normalizePaletteColor(palette[key] ?? '');
    if (!color) return null;
    payload[key] = color;
  }
  return payload;
}

/** Keeps the colors that ship with the template. Stored as `{}`. */
export const TEMPLATE_COLORS = 'template';
/** A stored palette that matches no preset. */
export const CUSTOM_COLORS = 'custom';

/**
 * Shellui color themes. `background` is the card, `muted` the page around it,
 * `primary` the button.
 */
export const EMAIL_COLOR_THEMES: ReadonlyArray<{ key: string; palette: EmailPalette }> = [
  {
    key: 'shellui',
    palette: {
      background: '#ffffff',
      foreground: '#1a1408',
      muted: '#f6f4ef',
      mutedForeground: '#6b645b',
      primary: '#e3a512',
      primaryForeground: '#1a1408',
      border: '#e7e0d4',
    },
  },
  {
    key: 'graphite',
    palette: {
      background: '#ffffff',
      foreground: '#18181b',
      muted: '#f4f4f5',
      mutedForeground: '#71717a',
      primary: '#18181b',
      primaryForeground: '#fafafa',
      border: '#e4e4e7',
    },
  },
  {
    key: 'ocean',
    palette: {
      background: '#ffffff',
      foreground: '#0b2540',
      muted: '#eef4fb',
      mutedForeground: '#5b6b7f',
      primary: '#1d6fd8',
      primaryForeground: '#ffffff',
      border: '#d6e2f0',
    },
  },
  {
    key: 'forest',
    palette: {
      background: '#ffffff',
      foreground: '#10291a',
      muted: '#f1f6f2',
      mutedForeground: '#5d6f63',
      primary: '#1f7a4a',
      primaryForeground: '#ffffff',
      border: '#d5e4da',
    },
  },
  {
    key: 'plum',
    palette: {
      background: '#ffffff',
      foreground: '#2a1430',
      muted: '#f7f1f8',
      mutedForeground: '#6f5f73',
      primary: '#7c3aed',
      primaryForeground: '#ffffff',
      border: '#e6dcea',
    },
  },
  {
    key: 'sunset',
    palette: {
      background: '#ffffff',
      foreground: '#2b1508',
      muted: '#fbf3ee',
      mutedForeground: '#7a6457',
      primary: '#e2582c',
      primaryForeground: '#ffffff',
      border: '#f0dfd5',
    },
  },
  {
    key: 'midnight',
    palette: {
      background: '#111827',
      foreground: '#f9fafb',
      muted: '#030712',
      mutedForeground: '#9ca3af',
      primary: '#6366f1',
      primaryForeground: '#ffffff',
      border: '#1f2937',
    },
  },
];

export function colorThemePalette(key: string): EmailPalette | null {
  return EMAIL_COLOR_THEMES.find((theme) => theme.key === key)?.palette ?? null;
}

/** Color theme key for a stored palette: a preset, `template` for `{}`, else `custom`. */
export function matchColorTheme(palette: Record<string, string> | null | undefined): string {
  const complete = completeThemePalette(palette);
  if (!complete) return TEMPLATE_COLORS;
  const match = EMAIL_COLOR_THEMES.find((theme) =>
    PALETTE_KEYS.every((key) => theme.palette[key] === complete[key]),
  );
  return match?.key ?? CUSTOM_COLORS;
}
