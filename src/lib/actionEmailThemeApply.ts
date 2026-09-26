import type { Editor } from '@tiptap/core';
import {
  EDITOR_THEMES,
  isThemeConfig,
  setCurrentTheme,
  setGlobalStyles,
  themeStylesToPanelOverrides,
  type EditorThemeInput,
} from '@react-email/editor/plugins';

/**
 * Force the active EmailEditor theme config into the document's globalContent.
 * Needed because React Email only seeds theme styles when the document has none;
 * switching Shellui themes would otherwise keep the previously embedded panels.
 */
export function applyThemeInputToEditor(
  editor: Editor | null | undefined,
  themeInput: EditorThemeInput,
): void {
  if (!editor) return;

  if (typeof themeInput === 'string') {
    if (themeInput === 'basic' || themeInput === 'minimal') {
      setCurrentTheme(editor, themeInput);
    }
    return;
  }

  if (!isThemeConfig(themeInput)) return;

  const baseTheme = themeInput.extends ?? 'minimal';
  const basePanels = EDITOR_THEMES[baseTheme];
  const panels = themeStylesToPanelOverrides(themeInput.styles, basePanels);
  setCurrentTheme(editor, baseTheme);
  setGlobalStyles(editor, panels);
}
