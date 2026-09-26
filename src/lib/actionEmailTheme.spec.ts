import { describe, expect, it } from 'vitest';
import {
  buildEmailThemeConfigFromPalette,
  getAppearanceAvailableThemes,
  resolveEmailThemeName,
} from '@/lib/actionEmailTheme';

const catalog = [
  {
    name: 'shellui',
    displayName: 'Shellui',
    colors: {
      light: { primary: '#111', muted: '#eee', background: '#fff', foreground: '#000' },
      dark: { primary: '#eee', muted: '#222', background: '#000', foreground: '#fff' },
    },
  },
  {
    name: 'claude',
    displayName: 'Claude',
    colors: {
      light: { primary: '#c00', muted: '#fdd', background: '#fff', foreground: '#111' },
      dark: { primary: '#f00', muted: '#300', background: '#111', foreground: '#eee' },
    },
  },
] as never;

describe('actionEmailTheme', () => {
  it('getAppearanceAvailableThemes filters invalid entries', () => {
    expect(
      getAppearanceAvailableThemes({
        availableThemes: [{ name: 'a', displayName: 'A', colors: { light: {}, dark: {} } }],
      } as never),
    ).toHaveLength(1);
    expect(getAppearanceAvailableThemes({ availableThemes: [{ name: '' }] } as never)).toHaveLength(
      0,
    );
  });

  it('resolveEmailThemeName prefers stored name in catalog', () => {
    const appearance = { name: 'shellui', mode: 'light', availableThemes: catalog } as never;
    expect(resolveEmailThemeName('claude', appearance)).toBe('claude');
  });

  it('resolveEmailThemeName maps legacy shellui-light to shellui', () => {
    const appearance = { name: 'shellui', mode: 'light', availableThemes: catalog } as never;
    expect(resolveEmailThemeName('shellui-light', appearance)).toBe('shellui');
  });

  it('resolveEmailThemeName falls back to active app theme', () => {
    const appearance = { name: 'claude', mode: 'light', availableThemes: catalog } as never;
    expect(resolveEmailThemeName(undefined, appearance)).toBe('claude');
  });

  it('buildEmailThemeConfigFromPalette sets button from primary', () => {
    const config = buildEmailThemeConfigFromPalette({
      primary: '#2563eb',
      primaryForeground: '#fff',
      background: '#fff',
      foreground: '#111',
      muted: '#f3f4f6',
      mutedForeground: '#666',
      radius: '6px',
    } as never);
    expect(config.extends).toBe('minimal');
    expect(config.styles?.button?.backgroundColor).toBe('#2563eb');
  });
});
