import { describe, expect, it } from 'vitest';
import { resolveStoredThemeId, themeIdFromAppearance } from '@/lib/actionEmailTheme';

describe('actionEmailTheme', () => {
  it('themeIdFromAppearance follows mode', () => {
    expect(themeIdFromAppearance({ mode: 'dark', colors: {} } as never)).toBe('shellui-dark');
    expect(themeIdFromAppearance({ mode: 'light', colors: {} } as never)).toBe('shellui-light');
  });

  it('resolveStoredThemeId keeps persisted ids', () => {
    expect(resolveStoredThemeId('shellui-dark', { mode: 'light', colors: {} } as never)).toBe(
      'shellui-dark',
    );
    expect(resolveStoredThemeId('shellui', { mode: 'light', colors: {} } as never)).toBe(
      'shellui-light',
    );
  });
});
