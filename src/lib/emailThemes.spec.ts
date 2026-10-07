import { describe, expect, it } from 'vitest';
import type { Appearance, SettingsAvailableTheme } from '@shellui/sdk';
import {
  cssColorToHex,
  emailThemeFrom,
  emailThemeStyle,
  emailDesignColors,
  parseEmailTheme,
  resolveEmailTheme,
  shelluiEmailThemes,
} from '@/lib/emailThemes';

function shelluiTheme(name: string, light: Record<string, string>): SettingsAvailableTheme {
  return {
    name,
    displayName: name[0].toUpperCase() + name.slice(1),
    colors: { light, dark: light } as unknown as SettingsAvailableTheme['colors'],
  };
}

describe('cssColorToHex', () => {
  it('reads every color form Shellui themes use', () => {
    expect(cssColorToHex('#0A66C2')).toBe('#0a66c2');
    expect(cssColorToHex('0a66c2')).toBe('#0a66c2');
    expect(cssColorToHex('#fff')).toBe('#ffffff');
    expect(cssColorToHex('rgb(20, 23, 30)')).toBe('#14171e');
    expect(cssColorToHex('rgb(20 23 30)')).toBe('#14171e');
    expect(cssColorToHex('hsl(0 100% 50%)')).toBe('#ff0000');
    expect(cssColorToHex('210 40% 98%')).toBe('#f8fafc');
    expect(cssColorToHex('oklch(1 0 0)')).toBe('#ffffff');
    expect(cssColorToHex('oklch(0 0 0)')).toBe('#000000');
    expect(cssColorToHex('oklch(0.205 0 0)')).toBe('#171717');
    expect(cssColorToHex('oklch(0.6271 0.2577 29.23)')).toBe('#ff0000');
    expect(cssColorToHex('oklch(62.71% 0.2577 29.23)')).toBe('#ff0000');
  });

  it('lays translucent colors on the backdrop and refuses the rest', () => {
    expect(cssColorToHex('oklch(0 0 0 / 50%)')).toBe('#808080');
    expect(cssColorToHex('rgba(0, 0, 0, 0.5)', '#000000')).toBe('#000000');
    expect(cssColorToHex('var(--primary)')).toBeNull();
    expect(cssColorToHex('red')).toBeNull();
    expect(cssColorToHex('')).toBeNull();
  });
});

describe('Shellui themes as email themes', () => {
  const ocean = shelluiTheme('ocean', {
    background: 'oklch(1 0 0)',
    foreground: '#0b1d33',
    card: '#ffffff',
    muted: '210 40% 96%',
    mutedForeground: '#4a6380',
    primary: '#0a66c2',
    primaryForeground: '#fafcff',
    border: 'oklch(0 0 0 / 10%)',
  });

  it('maps the light colors to the email roles', () => {
    expect(emailThemeFrom(ocean)).toEqual({
      name: 'ocean',
      label: 'Ocean',
      colors: {
        background: '#ffffff',
        foreground: '#0b1d33',
        card: '#ffffff',
        muted: '#f1f5f9',
        muted_foreground: '#4a6380',
        primary: '#0a66c2',
        primary_foreground: '#fafcff',
        border: '#e6e6e6',
      },
    });
    expect(emailThemeFrom(shelluiTheme('empty', { primary: 'nope' }))).toBeNull();
  });

  it('lists the available themes and the current one', () => {
    const forest = shelluiTheme('forest', { primary: '#14532d' });
    const appearance = {
      ...forest,
      mode: 'light',
      colorScheme: 'system',
      availableThemes: [ocean, forest],
    } as Appearance;
    const { themes, current } = shelluiEmailThemes(appearance);
    expect(themes.map((theme) => theme.name)).toEqual(['ocean', 'forest']);
    expect(current?.colors).toEqual({ primary: '#14532d' });
    expect(shelluiEmailThemes({ ...appearance, availableThemes: [] }).themes).toEqual([current]);
    expect(shelluiEmailThemes(null)).toEqual({ themes: [], current: null });
  });
});

describe('theme roles in a document', () => {
  const style =
    'color:var(--email-muted-foreground,rgb(123,125,129));background-color:var(--email-primary,rgb(20,23,30))';

  it('resolves like email-service', () => {
    expect(resolveEmailTheme(style, { primary: '#0a66c2' })).toBe(
      'color:rgb(123,125,129);background-color:#0a66c2',
    );
    expect(resolveEmailTheme(style, undefined)).toBe(
      'color:rgb(123,125,129);background-color:rgb(20,23,30)',
    );
    const document = { type: 'doc' as const, content: [{ type: 'paragraph', attrs: { style } }] };
    expect(emailDesignColors(document)).toEqual({
      muted_foreground: 'rgb(123,125,129)',
      primary: 'rgb(20,23,30)',
    });
    expect(emailDesignColors(resolveEmailTheme(document, {}))).toEqual({});
    expect(document.content[0].attrs.style).toBe(style);
  });

  it('sets the canvas variables', () => {
    expect(emailThemeStyle({ muted_foreground: '#4a6380', primary: '#0a66c2' })).toEqual({
      '--email-muted-foreground': '#4a6380',
      '--email-primary': '#0a66c2',
    });
    expect(emailThemeStyle(undefined)).toEqual({});
  });

  it('parses stored themes', () => {
    expect(parseEmailTheme({})).toBeNull();
    expect(parseEmailTheme(null)).toBeNull();
    expect(
      parseEmailTheme({ name: 'ocean', colors: { primary: '#0a66c2', bogus: '#000000' } }),
    ).toEqual({ name: 'ocean', label: 'ocean', colors: { primary: '#0a66c2' } });
    expect(parseEmailTheme({ name: 'ocean', colors: { primary: 'blue' } })).toBeNull();
  });
});
