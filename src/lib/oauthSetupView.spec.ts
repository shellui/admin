import { describe, expect, it } from 'vitest';
import type { OAuthSocialAppRow } from '@/lib/adminOauthClientsApi';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { visibleCatalogProviders } from '@/lib/oauthCatalogDisplay';
import {
  GENERIC_PROVIDER_ORDER,
  configuredProviderSlugs,
  isMultiInstanceCatalogProvider,
  isProviderConfigured,
  linkedSocialAppsByDocsSlug,
  oauthWizardStepFromParam,
  partitionProvidersForPicker,
  pickerHasAnyProvider,
  pickerSectionHeading,
  providerMatchesSearch,
} from '@/lib/oauthSetupView';
import i18n from '@/i18n';

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
    provider({ docs_slug: 'legacy_twitter', name: 'Twitter', tier: 'other', legacy: true }),
    provider({
      docs_slug: 'disabled_vendor',
      name: 'Disabled',
      tier: 'other',
      supported: false,
    }),
  ];

  it('visibleCatalogProviders drops legacy and unsupported', () => {
    const visible = visibleCatalogProviders(catalog);
    expect(visible.map((p) => p.docs_slug)).toEqual([
      'github',
      'google',
      'openid_connect',
      'saml',
      'openid',
      'oauth2',
      'box',
    ]);
  });

  it('partitions popular, generic (ordered), and other (by name)', () => {
    const sections = partitionProvidersForPicker(catalog, {});
    expect(sections.popular.map((p) => p.docs_slug)).toEqual(['github', 'google']);
    expect(sections.generic.map((p) => p.docs_slug)).toEqual([...GENERIC_PROVIDER_ORDER]);
    expect(sections.other.map((p) => p.docs_slug)).toEqual(['box']);
  });

  it('filters all tiers when searching', () => {
    const sections = partitionProvidersForPicker(catalog, { searchQuery: 'git' });
    expect(sections.popular.map((p) => p.docs_slug)).toEqual(['github']);
    expect(sections.generic).toHaveLength(0);
    expect(sections.other).toHaveLength(0);
    expect(pickerHasAnyProvider(sections)).toBe(true);
  });

  it('shows empty picker when search matches nothing', () => {
    const sections = partitionProvidersForPicker(catalog, { searchQuery: 'nomatch' });
    expect(pickerHasAnyProvider(sections)).toBe(false);
  });

  it('matches search on slug and name', () => {
    expect(providerMatchesSearch(catalog[0], 'git')).toBe(true);
    expect(providerMatchesSearch(catalog[0], 'nomatch')).toBe(false);
  });

  it('tracks configured provider slugs from linked social apps', () => {
    const slugs = configuredProviderSlugs([
      { provider: 'github', is_linked: true, id: 1, name: 'GitHub', client_id: 'a', mapping_id: null, mapping_is_active: false },
      { provider: 'Google', is_linked: true, id: 2, name: 'Google', client_id: 'b', mapping_id: null, mapping_is_active: false },
      { provider: 'box', is_linked: false, id: 3, name: 'Box', client_id: 'c', mapping_id: null, mapping_is_active: false },
    ] as OAuthSocialAppRow[]);
    expect(isProviderConfigured(provider({ docs_slug: 'github' }), slugs)).toBe(true);
    expect(isProviderConfigured(provider({ docs_slug: 'box' }), slugs)).toBe(false);
  });

  it('groups linked apps by docs slug and treats generic providers as multi instance', () => {
    const map = linkedSocialAppsByDocsSlug([
      { provider: 'openid_connect', is_linked: true, id: 10, name: 'OIDC', client_id: 'a', mapping_id: null, mapping_is_active: false },
      { provider: 'openid_connect', is_linked: true, id: 11, name: 'OIDC', client_id: 'b', mapping_id: null, mapping_is_active: false },
      { provider: 'github', is_linked: true, id: 12, name: 'GitHub', client_id: 'c', mapping_id: null, mapping_is_active: false },
    ] as OAuthSocialAppRow[]);
    expect(map.get('openid_connect')?.map((a) => a.id)).toEqual([10, 11]);
    expect(
      isMultiInstanceCatalogProvider(provider({ docs_slug: 'openid_connect', tier: 'generic' })),
    ).toBe(true);
    expect(isMultiInstanceCatalogProvider(provider({ docs_slug: 'github', tier: 'popular' }))).toBe(
      false,
    );
  });

  it('maps wizard step query params', () => {
    expect(oauthWizardStepFromParam('credentials')).toBe('credentials');
    expect(oauthWizardStepFromParam('3')).toBe('credentials');
    expect(oauthWizardStepFromParam('done')).toBe('summary');
  });

  it('omits section counts when five or fewer visible providers', () => {
    const t = i18n.getFixedT('en');
    expect(pickerSectionHeading(t, 'other', 5)).toBe('More providers');
    expect(pickerSectionHeading(t, 'other', 3)).toBe('More providers');
  });

  it('shows section counts when more than five visible providers', () => {
    const t = i18n.getFixedT('en');
    expect(pickerSectionHeading(t, 'popular', 13)).toBe('Popular providers (13)');
    expect(pickerSectionHeading(t, 'other', 14)).toBe('More providers (14)');
  });
});
