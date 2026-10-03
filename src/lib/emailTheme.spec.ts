import { describe, expect, it } from 'vitest';
import type { Appearance, SettingsAvailableTheme } from '@shellui/sdk';
import { paletteForThemeName, resolveEmailThemeName, themePalettePayload } from '@/lib/emailTheme';

const themes: SettingsAvailableTheme[] = [
  {
    name: 'shellui',
    displayName: 'Shellui',
    colors: {
      light: {
        background: '#fff',
        foreground: '#111',
        card: '#fff',
        cardForeground: '#111',
        popover: '#fff',
        popoverForeground: '#111',
        primary: '#e3a512',
        primaryForeground: '#1a1408',
        secondary: '#eee',
        secondaryForeground: '#111',
        muted: '#f6f4ef',
        mutedForeground: '#666',
        accent: '#eee',
        accentForeground: '#111',
        destructive: '#900',
        destructiveForeground: '#fff',
        border: '#ddd',
        input: '#ddd',
        ring: '#e3a512',
        radius: '8px',
        sidebarBackground: '#fff',
        sidebarForeground: '#111',
        sidebarPrimary: '#e3a512',
        sidebarPrimaryForeground: '#111',
        sidebarAccent: '#eee',
        sidebarAccentForeground: '#111',
        sidebarBorder: '#ddd',
        sidebarRing: '#e3a512',
      },
      dark: {
        background: '#111',
        foreground: '#fff',
        card: '#111',
        cardForeground: '#fff',
        popover: '#111',
        popoverForeground: '#fff',
        primary: '#e8b84a',
        primaryForeground: '#1a1408',
        secondary: '#222',
        secondaryForeground: '#fff',
        muted: '#222',
        mutedForeground: '#aaa',
        accent: '#222',
        accentForeground: '#fff',
        destructive: '#f66',
        destructiveForeground: '#111',
        border: '#333',
        input: '#333',
        ring: '#e8b84a',
        radius: '8px',
        sidebarBackground: '#111',
        sidebarForeground: '#fff',
        sidebarPrimary: '#e8b84a',
        sidebarPrimaryForeground: '#111',
        sidebarAccent: '#222',
        sidebarAccentForeground: '#fff',
        sidebarBorder: '#333',
        sidebarRing: '#e8b84a',
      },
    },
  },
  {
    name: 'ocean',
    displayName: 'Ocean',
    colors: {
      light: {
        background: '#fff',
        foreground: '#023',
        card: '#fff',
        cardForeground: '#023',
        popover: '#fff',
        popoverForeground: '#023',
        primary: '#036',
        primaryForeground: '#fff',
        secondary: '#eef',
        secondaryForeground: '#023',
        muted: '#eef',
        mutedForeground: '#456',
        accent: '#eef',
        accentForeground: '#023',
        destructive: '#900',
        destructiveForeground: '#fff',
        border: '#ccd',
        input: '#ccd',
        ring: '#036',
        radius: '8px',
        sidebarBackground: '#fff',
        sidebarForeground: '#023',
        sidebarPrimary: '#036',
        sidebarPrimaryForeground: '#fff',
        sidebarAccent: '#eef',
        sidebarAccentForeground: '#023',
        sidebarBorder: '#ccd',
        sidebarRing: '#036',
      },
      dark: {
        background: '#012',
        foreground: '#def',
        card: '#012',
        cardForeground: '#def',
        popover: '#012',
        popoverForeground: '#def',
        primary: '#6af',
        primaryForeground: '#012',
        secondary: '#123',
        secondaryForeground: '#def',
        muted: '#123',
        mutedForeground: '#9ab',
        accent: '#123',
        accentForeground: '#def',
        destructive: '#f66',
        destructiveForeground: '#012',
        border: '#234',
        input: '#234',
        ring: '#6af',
        radius: '8px',
        sidebarBackground: '#012',
        sidebarForeground: '#def',
        sidebarPrimary: '#6af',
        sidebarPrimaryForeground: '#012',
        sidebarAccent: '#123',
        sidebarAccentForeground: '#def',
        sidebarBorder: '#234',
        sidebarRing: '#6af',
      },
    },
  },
];

describe('resolveEmailThemeName', () => {
  it('keeps a stored theme that is still in appearance.availableThemes', () => {
    const appearance = { name: 'shellui', mode: 'light' } as Appearance;
    expect(resolveEmailThemeName('ocean', appearance, themes)).toBe('ocean');
    expect(resolveEmailThemeName('missing', appearance, themes)).toBe('shellui');
  });

  it('builds a preview palette from the picked theme', () => {
    const appearance = { name: 'shellui', mode: 'light' } as Appearance;
    expect(paletteForThemeName('ocean', appearance, themes).primary).toBe('#036');
  });
});

describe('themePalettePayload', () => {
  it('stores every key as #rrggbb', () => {
    const appearance = { name: 'ocean', mode: 'light' } as Appearance;
    const payload = themePalettePayload(paletteForThemeName('ocean', appearance, themes));
    expect(payload).toEqual({
      background: '#ffffff',
      foreground: '#002233',
      muted: '#eeeeff',
      mutedForeground: '#445566',
      primary: '#003366',
      primaryForeground: '#ffffff',
      border: '#ccccdd',
    });
  });
});
