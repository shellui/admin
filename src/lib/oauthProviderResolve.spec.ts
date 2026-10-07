import { describe, expect, it } from 'vitest';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import type { OAuthSocialAppRow } from '@/lib/adminOauthClientsApi';
import {
  buildOAuthCatalogIndex,
  catalogProviderForSocialApp,
  resolveSocialAppDocsSlug,
} from '@/lib/oauthProviderResolve';

function catalog(slug: string): OAuthCatalogProvider {
  return {
    docs_slug: slug,
    name: slug,
    tier: 'popular',
    legacy: false,
    replaced_by: null,
    protocol: 'OAuth2',
    supported: true,
    unsupported_reason: null,
    icon: {},
    docs_url: '',
    console_url: [],
    callback_url: '',
    extra_settings_schema: [],
  };
}

function social(
  partial: Partial<OAuthSocialAppRow> & Pick<OAuthSocialAppRow, 'id' | 'provider'>,
): OAuthSocialAppRow {
  return {
    name: partial.provider,
    client_id: 'id',
    is_linked: true,
    mapping_id: 1,
    mapping_is_active: true,
    ...partial,
  };
}

describe('resolveSocialAppDocsSlug', () => {
  it('maps Microsoft allauth id to microsoft docs slug', () => {
    expect(
      resolveSocialAppDocsSlug(
        social({ id: 1, provider: 'windowslive', allauth_provider: 'windowslive' }),
      ),
    ).toBe('microsoft');
  });

  it('prefers settings.catalog_slug for OpenID Connect apps', () => {
    expect(
      resolveSocialAppDocsSlug(
        social({
          id: 2,
          provider: 'acme-oidc',
          settings: { catalog_slug: 'openid_connect' },
        }),
      ),
    ).toBe('openid_connect');
  });

  it('passes through google and github provider ids', () => {
    expect(resolveSocialAppDocsSlug(social({ id: 3, provider: 'google' }))).toBe('google');
    expect(resolveSocialAppDocsSlug(social({ id: 4, provider: 'github' }))).toBe('github');
  });
});

describe('catalogProviderForSocialApp', () => {
  const index = buildOAuthCatalogIndex([
    catalog('google'),
    catalog('github'),
    catalog('microsoft'),
    catalog('openid_connect'),
  ]);

  it('resolves catalog rows for list and edit using the same docs slug', () => {
    const cases: OAuthSocialAppRow[] = [
      social({ id: 10, provider: 'google' }),
      social({ id: 11, provider: 'github' }),
      social({ id: 12, provider: 'windowslive', allauth_provider: 'windowslive' }),
      social({
        id: 13,
        provider: 'custom-oidc',
        settings: { catalog_slug: 'openid_connect' },
      }),
    ];
    for (const row of cases) {
      const slug = resolveSocialAppDocsSlug(row);
      const fromIndex = catalogProviderForSocialApp(row, index);
      expect(fromIndex?.docs_slug).toBe(slug);
    }
  });
});
