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

export function availableThemeNamesKey(themes: SettingsAvailableTheme[]): string {
  return themes.map((t) => t.name).join('\u0001');
}

/** Pick stored theme name if valid, else active app theme, else `shellui`, else first listed. */
export function resolveEmailThemeName(
  stored: string | undefined,
  appearance: Appearance | null,
  catalog?: SettingsAvailableTheme[],
): string | null {
  const themes = catalog ?? getAppearanceAvailableThemes(appearance);
  if (!themes.length) return stored?.trim() ? stored : null;

  const themeNameInCatalog = (name: string) => themes.some((t) => t.name === name);

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

export function palettePrimaryForThemeName(
  themeName: string | null,
  appearance: Appearance | null,
  catalog?: SettingsAvailableTheme[],
): string | null {
  if (!themeName) return null;
  const themes = catalog ?? getAppearanceAvailableThemes(appearance);
  const mode = appearance?.mode === 'dark' ? 'dark' : 'light';
  const entry = themes.find((t) => t.name === themeName);
  return entry?.colors?.[mode]?.primary ?? null;
}

function readCssColor(variable: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function paletteFromAppearance(
  appearance: Appearance | null,
  themeName: string | null,
  catalog?: SettingsAvailableTheme[],
): ThemeColorsMode | null {
  if (!appearance) return null;
  const mode = appearance.mode === 'dark' ? 'dark' : 'light';
  if (themeName) {
    const themes = catalog ?? getAppearanceAvailableThemes(appearance);
    const entry = themes.find((t) => t.name === themeName);
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
      : '8px';

  // Extend `basic` (not `minimal`): minimal's RESET omits button padding, so CTAs
  // render as flat colored strips. Basic ships padded buttons; we still override
  // colors and bump padding toward react.email barebones (px-7 / py-4).
  return extendTheme('basic', {
    body: {
      backgroundColor: palette.muted,
      color: palette.foreground,
      paddingTop: '32px',
      paddingRight: '16px',
      paddingBottom: '32px',
      paddingLeft: '16px',
    },
    container: {
      backgroundColor: palette.background,
      borderRadius: '8px',
      paddingTop: '40px',
      paddingRight: '40px',
      paddingBottom: '40px',
      paddingLeft: '40px',
    },
    h1: { color: palette.foreground },
    h2: { color: palette.foreground },
    paragraph: {
      color: palette.mutedForeground || palette.foreground,
      fontSize: '16px',
    },
    link: { color: palette.primary },
    button: {
      backgroundColor: palette.primary,
      color: buttonText,
      borderRadius,
      paddingTop: '16px',
      paddingRight: '28px',
      paddingBottom: '16px',
      paddingLeft: '28px',
      fontSize: '16px',
      fontWeight: 500,
      textDecoration: 'none',
      textAlign: 'center',
    },
  });
}

export function actionEmailThemeInput(
  themeName: string | null,
  appearance: Appearance | null,
  catalog?: SettingsAvailableTheme[],
): EditorThemeInput {
  const palette = paletteFromAppearance(appearance, themeName, catalog);
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
