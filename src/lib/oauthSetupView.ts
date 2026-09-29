import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';

/** Display order for generic protocol providers (after popular tiles). */
export const GENERIC_PROVIDER_ORDER = ['openid_connect', 'saml', 'openid', 'oauth2'] as const;

export type OAuthPickerSections = {
  popular: OAuthCatalogProvider[];
  generic: OAuthCatalogProvider[];
  other: OAuthCatalogProvider[];
};

export function normalizeProviderSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function providerMatchesSearch(provider: OAuthCatalogProvider, query: string): boolean {
  const q = normalizeProviderSearchQuery(query);
  if (!q) return true;
  const haystack = [
    provider.docs_slug,
    provider.name,
    provider.protocol,
    provider.unsupported_reason ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function filterCatalogProviders(
  providers: OAuthCatalogProvider[],
  options: {
    includeLegacy: boolean;
    searchQuery?: string;
  },
): OAuthCatalogProvider[] {
  const searchQuery = options.searchQuery ?? '';
  return providers.filter((provider) => {
    if (provider.legacy && !options.includeLegacy) return false;
    if (!providerMatchesSearch(provider, searchQuery)) return false;
    return true;
  });
}

function genericSortIndex(docsSlug: string): number {
  const idx = GENERIC_PROVIDER_ORDER.indexOf(docsSlug as (typeof GENERIC_PROVIDER_ORDER)[number]);
  return idx === -1 ? GENERIC_PROVIDER_ORDER.length : idx;
}

export function partitionProvidersForPicker(
  providers: OAuthCatalogProvider[],
  options: {
    includeLegacy: boolean;
    searchQuery?: string;
  },
): OAuthPickerSections {
  const base = filterCatalogProviders(providers, {
    includeLegacy: options.includeLegacy,
  });
  const popular: OAuthCatalogProvider[] = [];
  const generic: OAuthCatalogProvider[] = [];
  const other: OAuthCatalogProvider[] = [];

  for (const provider of base) {
    if (provider.tier === 'popular') {
      popular.push(provider);
    } else if (provider.tier === 'generic') {
      generic.push(provider);
    } else {
      other.push(provider);
    }
  }

  generic.sort((a, b) => genericSortIndex(a.docs_slug) - genericSortIndex(b.docs_slug));
  const searchQuery = options.searchQuery ?? '';
  const searchedOther = searchQuery.trim()
    ? other.filter((provider) => providerMatchesSearch(provider, searchQuery))
    : other;
  searchedOther.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return { popular, generic, other: searchedOther };
}

export function configuredProviderSlugs(
  socialApps: ReadonlyArray<{ provider: string; is_linked?: boolean }>,
): Set<string> {
  const slugs = new Set<string>();
  for (const row of socialApps) {
    if (row.is_linked === false) continue;
    const slug = String(row.provider || '')
      .trim()
      .toLowerCase();
    if (slug) slugs.add(slug);
  }
  return slugs;
}

export function isProviderConfigured(
  provider: OAuthCatalogProvider,
  configuredSlugs: ReadonlySet<string>,
): boolean {
  return configuredSlugs.has(provider.docs_slug.toLowerCase());
}

export type OAuthWizardStep = 'pick' | 'console' | 'credentials' | 'summary';

export function oauthWizardStepFromParam(raw: string | null | undefined): OAuthWizardStep | null {
  const key = String(raw || '')
    .trim()
    .toLowerCase();
  if (key === 'pick' || key === '1') return 'pick';
  if (key === 'console' || key === '2') return 'console';
  if (key === 'credentials' || key === '3') return 'credentials';
  if (key === 'summary' || key === '4' || key === 'done') return 'summary';
  return null;
}
