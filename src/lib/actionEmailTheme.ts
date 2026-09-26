import { extendTheme, type EditorThemeInput, type ThemeConfig } from '@react-email/editor/plugins';
import type { Appearance, SettingsAvailableTheme, ThemeColorsMode } from '@shellui/sdk';

/** Persisted on identity email_templates[lang].theme_id (Shellui theme `name`). */
export type ActionEmailThemeName = string;

export function getAppearanceAvailableThemes(
  appearance: Appearance | null | undefined,
): SettingsAvailableTheme[] {
  const list = appearance?.availableThemes;
  if (!Array.isArray(list)) return [];
  return list.filter((t): t is SettingsAvailableTheme =>
    Boolean(t && typeof t.name === 'string' && typeof t.displayName === 'string'),
  );
}

function themeNameInList(name: string, appearance: Appearance | null): boolean {
  return getAppearanceAvailableThemes(appearance).some((t) => t.name === name);
}

/** Pick stored theme name if valid, else active app theme, else `shellui`, else first listed. */
export function resolveEmailThemeName(
  stored: string | undefined,
  appearance: Appearance | null,
): string | null {
  const themes = getAppearanceAvailableThemes(appearance);
  if (!themes.length) return null;

  const normalizeStored = (raw: string | undefined): string | undefined => {
    if (!raw) return undefined;
    if (themeNameInList(raw, appearance)) return raw;
    if (raw === 'shellui-light' || raw === 'shellui-dark') {
      if (themeNameInList('shellui', appearance)) return 'shellui';
    }
    return undefined;
  };

  const fromStored = normalizeStored(stored);
  if (fromStored) return fromStored;

  const activeName = appearance?.name;
  if (activeName && themeNameInList(activeName, appearance)) return activeName;
  if (themeNameInList('shellui', appearance)) return 'shellui';
  return themes[0]?.name ?? null;
}

function readCssColor(variable: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function paletteFromAppearance(
  appearance: Appearance | null,
  themeName: string | null,
): ThemeColorsMode | null {
  if (!appearance) return null;
  const mode = appearance.mode === 'dark' ? 'dark' : 'light';
  if (themeName) {
    const entry = getAppearanceAvailableThemes(appearance).find((t) => t.name === themeName);
    const fromCatalog = entry?.colors?.[mode];
    if (fromCatalog) return fromCatalog;
  }
  return appearance.colors?.[mode] ?? null;
}

export function buildEmailThemeConfigFromPalette(palette: ThemeColorsMode): ThemeConfig {
  const buttonText = palette.primaryForeground || '#ffffff';
  const radiusRaw = palette.radius?.trim();
  const borderRadius =
    radiusRaw && radiusRaw.length > 0
      ? radiusRaw.includes('px') || radiusRaw.includes('rem')
        ? radiusRaw
        : `${radiusRaw}px`
      : '6px';

  return extendTheme('minimal', {
    body: { backgroundColor: palette.muted, color: palette.foreground },
    container: { backgroundColor: palette.background },
    h1: { color: palette.foreground },
    h2: { color: palette.foreground },
    paragraph: { color: palette.mutedForeground || palette.foreground },
    link: { color: palette.primary },
    button: {
      backgroundColor: palette.primary,
      color: buttonText,
      borderRadius,
    },
  });
}

export function actionEmailThemeInput(
  themeName: string | null,
  appearance: Appearance | null,
): EditorThemeInput {
  const palette = paletteFromAppearance(appearance, themeName);
  if (palette) return buildEmailThemeConfigFromPalette(palette);

  return buildEmailThemeConfigFromPalette({
    background: readCssColor('--background', '#ffffff'),
    foreground: readCssColor('--foreground', '#111827'),
    card: readCssColor('--card', '#ffffff'),
    cardForeground: readCssColor('--card-foreground', '#111827'),
    popover: readCssColor('--popover', '#ffffff'),
    popoverForeground: readCssColor('--popover-foreground', '#111827'),
    primary: readCssColor('--primary', '#2563eb'),
    primaryForeground: '#ffffff',
    secondary: readCssColor('--secondary', '#f3f4f6'),
    secondaryForeground: readCssColor('--secondary-foreground', '#111827'),
    muted: readCssColor('--muted', '#f3f4f6'),
    mutedForeground: readCssColor('--muted-foreground', '#6b7280'),
    accent: readCssColor('--accent', '#f3f4f6'),
    accentForeground: readCssColor('--accent-foreground', '#111827'),
    destructive: readCssColor('--destructive', '#dc2626'),
    destructiveForeground: '#ffffff',
    border: readCssColor('--border', '#e5e7eb'),
    input: readCssColor('--input', '#e5e7eb'),
    ring: readCssColor('--ring', '#2563eb'),
    radius: '0.375rem',
    sidebarBackground: readCssColor('--sidebar-background', '#fafafa'),
    sidebarForeground: readCssColor('--sidebar-foreground', '#111827'),
    sidebarPrimary: readCssColor('--sidebar-primary', '#2563eb'),
    sidebarPrimaryForeground: '#ffffff',
    sidebarAccent: readCssColor('--sidebar-accent', '#f3f4f6'),
    sidebarAccentForeground: readCssColor('--sidebar-accent-foreground', '#111827'),
    sidebarBorder: readCssColor('--sidebar-border', '#e5e7eb'),
    sidebarRing: readCssColor('--sidebar-ring', '#2563eb'),
  });
}
