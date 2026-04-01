import {
  KEY_TO_CSS_VAR,
  applyVariablesToRoot,
  applyTypographyFromAppearance,
  applyFontFiles,
} from './themeUtils';

export function getAppearanceFromSettings(
  settings: import('@shellui/sdk').Settings | null | undefined,
) {
  return settings?.appearance ?? null;
}

export function getAppearanceFromPayload(
  payload:
    | { settings?: import('@shellui/sdk').Settings }
    | import('@shellui/sdk').Settings
    | null
    | undefined,
): import('@shellui/sdk').Appearance | null {
  if (!payload || typeof payload !== 'object') return null;
  const settings = 'settings' in payload ? payload.settings : payload;
  return settings?.appearance ?? null;
}

export function applyThemeToDocument(appearance: import('@shellui/sdk').Appearance | null) {
  const root = document.documentElement;
  if (!appearance) {
    root.classList.remove('dark');
    return;
  }

  if (appearance.mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const colorsForMode = appearance.colors?.[appearance.mode];
  if (colorsForMode && typeof colorsForMode === 'object') {
    const variables: Record<string, string> = {};
    for (const [key, value] of Object.entries(colorsForMode)) {
      const cssVar = KEY_TO_CSS_VAR[key];
      if (cssVar && value != null) variables[cssVar] = value;
    }
    applyVariablesToRoot(root, variables);
  }

  applyTypographyFromAppearance(root, appearance);
  applyFontFiles(appearance.fontFiles);

  const primary =
    typeof getComputedStyle !== 'undefined'
      ? getComputedStyle(root).getPropertyValue('--primary').trim()
      : '';
  if (primary) {
    root.style.setProperty('--link', primary);
  }
}
