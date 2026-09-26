import { extendTheme, type EditorThemeInput, type ThemeConfig } from '@react-email/editor/plugins';

export type ActionEmailThemeChoice = 'basic' | 'minimal' | 'shellui';

export function actionEmailThemeInput(
  choice: ActionEmailThemeChoice,
  shelluiAppearance: import('@shellui/sdk').Appearance | null,
): EditorThemeInput {
  if (choice !== 'shellui') return choice;
  return buildShelluiEmailTheme(shelluiAppearance);
}

function readCssColor(variable: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

export function buildShelluiEmailTheme(
  appearance: import('@shellui/sdk').Appearance | null,
): ThemeConfig {
  const mode = appearance?.mode === 'dark' ? 'dark' : 'light';
  const palette = appearance?.colors?.[mode];
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
