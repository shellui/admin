import { describe, expect, it } from 'vitest';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import {
  GENERIC_PROVIDER_ORDER,
  configuredProviderSlugs,
  filterCatalogProviders,
  isProviderConfigured,
  oauthWizardStepFromParam,
  partitionProvidersForPicker,
  providerMatchesSearch,
} from '@/lib/oauthSetupView';

function provider(
  partial: Partial<OAuthCatalogProvider> & Pick<OAuthCatalogProvider, 'docs_slug'>,
): OAuthCatalogProvider {
  return {
    name: partial.docs_slug,
    tier: 'other',
    legacy: false,
    replaced_by: null,
    protocol: 'OAuth2',
    supported: true,
    unsupported_reason: null,
    icon: {},
    docs_url: '',
    console_url: [],
    callback_url: 'https://identity.example/api/v1/oauth/callback',
    extra_settings_schema: [],
    ...partial,
  };
}

describe('oauthSetupView', () => {
  const catalog: OAuthCatalogProvider[] = [
    provider({ docs_slug: 'github', name: 'GitHub', tier: 'popular' }),
    provider({ docs_slug: 'google', name: 'Google', tier: 'popular' }),
    provider({
      docs_slug: 'openid_connect',
      name: 'OpenID Connect',
      tier: 'generic',
      protocol: 'OIDC',
    }),
    provider({ docs_slug: 'saml', name: 'SAML', tier: 'generic', protocol: 'SAML' }),
    provider({ docs_slug: 'openid', name: 'OpenID', tier: 'generic' }),
    provider({ docs_slug: 'oauth2', name: 'OAuth2', tier: 'generic' }),
    provider({ docs_slug: 'box', name: 'Box', tier: 'other' }),
    provider({
      docs_slug: 'twitter',
      name: 'Twitter',
      tier: 'other',
      legacy: true,
      replaced_by: 'twitter_oauth2',
    }),
    provider({
      docs_slug: 'unsupported_vendor',
      name: 'Unsupported',
      tier: 'other',
      supported: false,
      unsupported_reason: 'Not enabled on this deployment.',
    }),
  ];

  it('partitions popular, generic (ordered), and other (by name)', () => {
    const sections = partitionProvidersForPicker(catalog, { includeLegacy: true });
    expect(sections.popular.map((p) => p.docs_slug)).toEqual(['github', 'google']);
    expect(sections.generic.map((p) => p.docs_slug)).toEqual([...GENERIC_PROVIDER_ORDER]);
    expect(sections.other.map((p) => p.docs_slug)).toEqual([
      'box',
      'twitter',
      'unsupported_vendor',
    ]);
  });

  it('hides legacy providers unless includeLegacy is true', () => {
    const hidden = partitionProvidersForPicker(catalog, { includeLegacy: false });
    expect(hidden.other.some((p) => p.docs_slug === 'twitter')).toBe(false);
    const shown = partitionProvidersForPicker(catalog, { includeLegacy: true });
    expect(shown.other.some((p) => p.docs_slug === 'twitter')).toBe(true);
  });

  it('filters other providers by search query', () => {
    const sections = partitionProvidersForPicker(catalog, {
      includeLegacy: false,
      searchQuery: 'box',
    });
    expect(sections.other.map((p) => p.docs_slug)).toEqual(['box']);
    expect(sections.popular).toHaveLength(2);
  });

  it('matches search on slug, name, and unsupported_reason', () => {
    expect(providerMatchesSearch(catalog[8], 'not enabled')).toBe(true);
    expect(providerMatchesSearch(catalog[0], 'git')).toBe(true);
    expect(providerMatchesSearch(catalog[0], 'nomatch')).toBe(false);
  });

  it('tracks configured provider slugs from linked social apps', () => {
    const slugs = configuredProviderSlugs([
      { provider: 'github', is_linked: true },
      { provider: 'Google', is_linked: true },
      { provider: 'box', is_linked: false },
    ]);
    expect(isProviderConfigured(provider({ docs_slug: 'github' }), slugs)).toBe(true);
    expect(isProviderConfigured(provider({ docs_slug: 'box' }), slugs)).toBe(false);
  });

  it('maps wizard step query params', () => {
    expect(oauthWizardStepFromParam('credentials')).toBe('credentials');
    expect(oauthWizardStepFromParam('3')).toBe('credentials');
    expect(oauthWizardStepFromParam('done')).toBe('summary');
  });

  it('keeps unsupported providers visible in filtered lists', () => {
    const list = filterCatalogProviders(catalog, { includeLegacy: false });
    const unsupported = list.find((p) => p.docs_slug === 'unsupported_vendor');
    expect(unsupported?.supported).toBe(false);
  });
});
