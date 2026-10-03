import type { Appearance, SettingsAvailableTheme, ThemeColorsMode } from '@shellui/sdk';
import { SHELLUI_EMAIL_PALETTE, type EmailPreviewPalette } from '@/lib/emailDocument';

export function getAppearanceAvailableThemes(
  appearance: Appearance | null | undefined,
): SettingsAvailableTheme[] {
  const list = appearance?.availableThemes;
  if (!Array.isArray(list)) return [];
  return list.filter((theme): theme is SettingsAvailableTheme =>
    Boolean(theme && typeof theme.name === 'string' && typeof theme.displayName === 'string'),
  );
}

export function availableThemeNamesKey(themes: SettingsAvailableTheme[]): string {
  return themes.map((theme) => theme.name).join('\u0001');
}

/** Stored theme if it is still listed, else the active theme, else `shellui`, else the first theme. */
export function resolveEmailThemeName(
  stored: string | undefined,
  appearance: Appearance | null,
  catalog?: SettingsAvailableTheme[],
): string | null {
  const themes = catalog ?? getAppearanceAvailableThemes(appearance);
  if (!themes.length) return stored?.trim() ? stored : null;

  const themeNameInCatalog = (name: string) => themes.some((theme) => theme.name === name);

  const normalizeStored = (raw: string | undefined): string | undefined => {
    if (!raw) return undefined;
    if (themeNameInCatalog(raw)) return raw;
    if (raw === 'shellui-light' || raw === 'shellui-dark') {
      if (themeNameInCatalog('shellui')) return 'shellui';
    }
    return undefined;
  };

  const fromStored = normalizeStored(stored);
  if (fromStored) return fromStored;

  const activeName = appearance?.name;
  if (activeName && themeNameInCatalog(activeName)) return activeName;
  if (themeNameInCatalog('shellui')) return 'shellui';
  return themes[0]?.name ?? null;
}

export function paletteForThemeName(
  themeName: string | null,
  appearance: Appearance | null,
  catalog?: SettingsAvailableTheme[],
): EmailPreviewPalette {
  const mode = appearance?.mode === 'dark' ? 'dark' : 'light';
  const themes = catalog ?? getAppearanceAvailableThemes(appearance);
  const entry = themeName ? themes.find((theme) => theme.name === themeName) : undefined;
  const colors: ThemeColorsMode | undefined = entry?.colors?.[mode] ?? appearance?.colors?.[mode];
  if (!colors) return SHELLUI_EMAIL_PALETTE;
  return {
    background: colors.background || SHELLUI_EMAIL_PALETTE.background,
    foreground: colors.foreground || SHELLUI_EMAIL_PALETTE.foreground,
    muted: colors.muted || SHELLUI_EMAIL_PALETTE.muted,
    mutedForeground: colors.mutedForeground || SHELLUI_EMAIL_PALETTE.mutedForeground,
    primary: colors.primary || SHELLUI_EMAIL_PALETTE.primary,
    primaryForeground: colors.primaryForeground || SHELLUI_EMAIL_PALETTE.primaryForeground,
    border: colors.border || SHELLUI_EMAIL_PALETTE.border,
  };
}

export const EMAIL_THEME_KEYS = ['barebone', 'matte', 'protocol', 'arcane', 'studio'] as const;

export type EmailThemeKey = (typeof EMAIL_THEME_KEYS)[number];

export function isEmailThemeKey(value: string): value is EmailThemeKey {
  return (EMAIL_THEME_KEYS as readonly string[]).includes(value);
}

/** `shellui` and unknown names fall back to the company theme, then Barebone. */
export function emailThemeKeyOrDefault(
  value: string | null | undefined,
  fallback: string,
): EmailThemeKey {
  if (value && isEmailThemeKey(value)) return value;
  if (isEmailThemeKey(fallback)) return fallback;
  return 'barebone';
}

const PALETTE_KEYS = [
  'background',
  'foreground',
  'muted',
  'mutedForeground',
  'primary',
  'primaryForeground',
  'border',
] as const;

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

/**
 * Palette stored on a template version.
 * Every key is `#rrggbb`. A color the service cannot store falls back to the Shellui palette.
 */
/** All seven colors, or null when the palette is partial. Partial palettes are rejected. */
export function completeThemePalette(
  palette: Record<string, string> | null | undefined,
): Record<string, string> | null {
  if (!palette) return null;
  const payload: Record<string, string> = {};
  for (const key of PALETTE_KEYS) {
    const color = normalizePaletteColor(palette[key] ?? '');
    if (!color) return null;
    payload[key] = color;
  }
  return payload;
}

export function themePalettePayload(palette: EmailPreviewPalette): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const key of PALETTE_KEYS) {
    payload[key] =
      normalizePaletteColor(palette[key]) ?? normalizePaletteColor(SHELLUI_EMAIL_PALETTE[key])!;
  }
  return payload;
}
