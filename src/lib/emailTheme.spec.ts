import { describe, expect, it } from 'vitest';
import {
  CUSTOM_COLORS,
  EMAIL_COLOR_THEMES,
  TEMPLATE_COLORS,
  colorThemePalette,
  completeThemePalette,
  emailThemeKeyOrDefault,
  matchColorTheme,
} from '@/lib/emailTheme';

describe('emailThemeKeyOrDefault', () => {
  it('keeps a known template and falls back to the company template', () => {
    expect(emailThemeKeyOrDefault('matte', 'studio')).toBe('matte');
    expect(emailThemeKeyOrDefault('shellui', 'studio')).toBe('studio');
    expect(emailThemeKeyOrDefault(null, 'missing')).toBe('barebone');
  });
});

describe('completeThemePalette', () => {
  it('stores every key as #rrggbb and rejects partial palettes', () => {
    expect(
      completeThemePalette({
        background: '#fff',
        foreground: '#023',
        muted: '#eef',
        mutedForeground: '#456',
        primary: '#036',
        primaryForeground: '#FFF',
        border: '#ccd',
      }),
    ).toEqual({
      background: '#ffffff',
      foreground: '#002233',
      muted: '#eeeeff',
      mutedForeground: '#445566',
      primary: '#003366',
      primaryForeground: '#ffffff',
      border: '#ccccdd',
    });
    expect(completeThemePalette({ primary: '#036' })).toBeNull();
  });
});

describe('matchColorTheme', () => {
  it('maps a stored palette back to its color theme', () => {
    expect(matchColorTheme({})).toBe(TEMPLATE_COLORS);
    expect(matchColorTheme(null)).toBe(TEMPLATE_COLORS);
    const ocean = colorThemePalette('ocean');
    expect(matchColorTheme(ocean)).toBe('ocean');
    expect(matchColorTheme({ ...ocean, primary: '#000000' })).toBe(CUSTOM_COLORS);
  });

  it('only ships complete, storable presets', () => {
    for (const theme of EMAIL_COLOR_THEMES) {
      expect(completeThemePalette(theme.palette)).toEqual(theme.palette);
    }
  });
});
