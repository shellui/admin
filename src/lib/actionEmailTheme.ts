import { extendTheme, type EditorThemeInput, type ThemeConfig } from '@react-email/editor/plugins';

/** Persisted on identity email_templates[lang].theme_id */
export type ActionEmailThemeId = 'shellui-light' | 'shellui-dark';

export function themeIdFromAppearance(
  appearance: import('@shellui/sdk').Appearance | null,
): ActionEmailThemeId {
  return appearance?.mode === 'dark' ? 'shellui-dark' : 'shellui-light';
}

export function resolveStoredThemeId(
  stored: string | undefined,
  appearance: import('@shellui/sdk').Appearance | null,
): ActionEmailThemeId {
  if (stored === 'shellui-light' || stored === 'shellui-dark') return stored;
  if (stored === 'shellui') return themeIdFromAppearance(appearance);
  return themeIdFromAppearance(appearance);
}

export function actionEmailThemeInput(
  themeId: ActionEmailThemeId,
  appearance: import('@shellui/sdk').Appearance | null,
): EditorThemeInput {
  return buildShelluiEmailTheme(themeId, appearance);
}

function readCssColor(variable: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function paletteForThemeId(
  themeId: ActionEmailThemeId,
  appearance: import('@shellui/sdk').Appearance | null,
) {
  const mode = themeId === 'shellui-dark' ? 'dark' : 'light';
  const fromAppearance = appearance?.colors?.[mode];
  if (fromAppearance && typeof fromAppearance === 'object') {
    return fromAppearance;
  }
  return null;
}

export function buildShelluiEmailTheme(
  themeId: ActionEmailThemeId,
  appearance: import('@shellui/sdk').Appearance | null,
): ThemeConfig {
  const palette = paletteForThemeId(themeId, appearance);
  const primary = palette?.primary ?? readCssColor('--primary', '#2563eb');
  const foreground = palette?.foreground ?? readCssColor('--foreground', '#111827');
  const background = palette?.background ?? readCssColor('--background', '#ffffff');
  const muted = palette?.muted ?? readCssColor('--muted', '#f3f4f6');

  return extendTheme('minimal', {
    body: { backgroundColor: muted, color: foreground },
    container: { backgroundColor: background },
    h1: { color: foreground },
    h2: { color: foreground },
    paragraph: { color: foreground },
    link: { color: primary },
    button: {
      backgroundColor: primary,
      color: '#ffffff',
      borderRadius: '6px',
    },
  });
}
