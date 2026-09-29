import { describe, expect, it } from 'vitest';
import type { OAuthConsoleUrlEntry } from '@/lib/oauthProviderCatalogTypes';
import { isConsoleUrlLinkable } from '@/lib/oauthConsoleUrl';
import { parseCatalogProvider } from '@/lib/oauthProviderCatalogParsers';
import {
  consoleUrlPresentation,
  extractConsoleUrlFromLegacyCopy,
  inferConsoleUrlKind,
  splitConsoleUrlTemplate,
} from '@/lib/oauthConsoleUrlKind';

describe('oauthConsoleUrlKind', () => {
  it('infers kind from legacy label text', () => {
    expect(
      inferConsoleUrlKind({
        label: 'App registration (get your key and secret here)',
        url: 'https://example.com',
        form: 'link',
      }),
    ).toBe('app_registration');
    expect(
      inferConsoleUrlKind({
        label: 'Developer portal',
        url: 'https://example.com',
        form: 'link',
      }),
    ).toBe('developer_console');
  });

  it('treats template URLs as non-link presentation', () => {
    const entry: OAuthConsoleUrlEntry = {
      kind: 'app_registration',
      url: 'https://bitbucket.org/{{yourusername}}/oauth',
      form: 'template',
    };
    expect(consoleUrlPresentation(entry)).toBe('template');
    expect(isConsoleUrlLinkable(entry)).toBe(false);
  });

  it('allows plain HTTPS console links', () => {
    const entry: OAuthConsoleUrlEntry = {
      kind: 'developer_console',
      url: 'https://github.com/settings/developers',
      form: 'link',
    };
    expect(consoleUrlPresentation(entry)).toBe('link');
    expect(isConsoleUrlLinkable(entry)).toBe(true);
  });

  it('extracts HTTPS URL from legacy parenthetical copy', () => {
    expect(
      extractConsoleUrlFromLegacyCopy(
        '',
        'App registration (get your key and secret here) (https://www.linkedin.com/secure/developer?newapp=)',
      ),
    ).toBe('https://www.linkedin.com/secure/developer?newapp=');
  });

  it('parses multiple_allowed from the catalog', () => {
    const multi = parseCatalogProvider({
      docs_slug: 'openid_connect',
      name: 'OpenID Connect',
      multiple_allowed: true,
    });
    const single = parseCatalogProvider({
      docs_slug: 'github',
      name: 'GitHub',
      multiple_allowed: false,
    });
    const legacy = parseCatalogProvider({ docs_slug: 'google', name: 'Google' });
    expect(multi?.multiple_allowed).toBe(true);
    expect(single?.multiple_allowed).toBe(false);
    expect(legacy?.multiple_allowed).toBeUndefined();
  });

  it('parses legacy console_url entries without exposing label in structured fields', () => {
    const provider = parseCatalogProvider({
      docs_slug: 'linkedin',
      name: 'LinkedIn',
      console_url: [
        {
          label: 'App registration (get your key and secret here)',
          url: 'https://www.linkedin.com/secure/developer?newapp=',
        },
      ],
    });
    expect(provider?.console_url[0]?.kind).toBe('app_registration');
    expect(provider?.console_url[0]?.url).toBe('https://www.linkedin.com/secure/developer?newapp=');
  });

  it('splits placeholder segments for template display', () => {
    const segments = splitConsoleUrlTemplate('https://example.com/{{tenant}}/apps/{{id}}');
    expect(segments.filter((s) => s.type === 'placeholder').map((s) => s.value)).toEqual([
      '{{tenant}}',
      '{{id}}',
    ]);
  });
});
