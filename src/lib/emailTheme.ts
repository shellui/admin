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

/** Compact palette stored on the template version. The service accepts it and does not render it yet. */
export function themePalettePayload(palette: EmailPreviewPalette): Record<string, string> {
  return { ...palette };
}
