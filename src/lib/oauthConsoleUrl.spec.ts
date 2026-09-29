import { describe, expect, it } from 'vitest';
import {
  consoleUrlHasPlaceholder,
  consoleUrlHintText,
  isConsoleUrlLinkable,
} from '@/lib/oauthConsoleUrl';

describe('oauthConsoleUrl', () => {
  it('detects placeholder segments in URLs', () => {
    expect(consoleUrlHasPlaceholder('https://example.com/{{yourusername}}/app')).toBe(true);
    expect(consoleUrlHasPlaceholder('https://example.com/app')).toBe(false);
  });

  it('treats non-link form entries as hints', () => {
    expect(
      isConsoleUrlLinkable({
        text: 'hint',
        url: 'https://example.com',
        label: 'Register',
        form: 'instructions',
      }),
    ).toBe(false);
  });

  it('blocks link buttons when URL contains placeholders', () => {
    expect(
      isConsoleUrlLinkable({
        text: 'https://bitbucket.org/{{yourusername}}/oauth',
        url: 'https://bitbucket.org/{{yourusername}}/oauth',
        label: 'App registration',
        form: 'link',
      }),
    ).toBe(false);
  });

  it('allows plain HTTPS console links', () => {
    expect(
      isConsoleUrlLinkable({
        text: 'https://github.com/settings/developers',
        url: 'https://github.com/settings/developers',
        label: 'GitHub developer settings',
        form: 'link',
      }),
    ).toBe(true);
  });

  it('builds hint text for non-link entries', () => {
    expect(
      consoleUrlHintText({
        text: 'https://example.com/{{tenant}}/app',
        url: 'https://example.com/{{tenant}}/app',
        label: 'Replace tenant in URL',
        form: 'text',
      }),
    ).toContain('{{tenant}}');
  });
});
