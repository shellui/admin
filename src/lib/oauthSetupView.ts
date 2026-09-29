import type { TFunction } from 'i18next';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { visibleCatalogProviders } from '@/lib/oauthCatalogDisplay';
import { resolveSocialAppDocsSlug } from '@/lib/oauthProviderResolve';
import type { OAuthSocialAppRow } from '@/lib/adminOauthClientsApi';

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
  const haystack = [provider.docs_slug, provider.name, provider.protocol].join(' ').toLowerCase();
  return haystack.includes(q);
}

function genericSortIndex(docsSlug: string): number {
  const idx = GENERIC_PROVIDER_ORDER.indexOf(docsSlug as (typeof GENERIC_PROVIDER_ORDER)[number]);
  return idx === -1 ? GENERIC_PROVIDER_ORDER.length : idx;
}

export function partitionProvidersForPicker(
  providers: OAuthCatalogProvider[],
  options: {
    searchQuery?: string;
  },
): OAuthPickerSections {
  const base = visibleCatalogProviders(providers);
  const q = normalizeProviderSearchQuery(options.searchQuery ?? '');
  const filtered = q ? base.filter((p) => providerMatchesSearch(p, q)) : base;

  const popular: OAuthCatalogProvider[] = [];
  const generic: OAuthCatalogProvider[] = [];
  const other: OAuthCatalogProvider[] = [];

  for (const provider of filtered) {
    if (provider.tier === 'popular') {
      popular.push(provider);
    } else if (provider.tier === 'generic') {
      generic.push(provider);
    } else {
      other.push(provider);
    }
  }

  generic.sort((a, b) => genericSortIndex(a.docs_slug) - genericSortIndex(b.docs_slug));
  other.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return { popular, generic, other };
}

export function pickerHasAnyProvider(sections: OAuthPickerSections): boolean {
  return sections.popular.length + sections.generic.length + sections.other.length > 0;
}

export function configuredProviderSlugs(
  socialApps: ReadonlyArray<
    Parameters<typeof resolveSocialAppDocsSlug>[0] & { is_linked?: boolean }
  >,
): Set<string> {
  const slugs = new Set<string>();
  for (const slug of linkedSocialAppsByDocsSlug(socialApps).keys()) {
    slugs.add(slug);
  }
  return slugs;
}

/** Linked social apps grouped by catalog docs_slug (lowercase). */
export function linkedSocialAppsByDocsSlug(
  socialApps: ReadonlyArray<
    Parameters<typeof resolveSocialAppDocsSlug>[0] & { is_linked?: boolean }
  >,
): Map<string, OAuthSocialAppRow[]> {
  const map = new Map<string, OAuthSocialAppRow[]>();
  for (const row of socialApps) {
    if (row.is_linked === false) continue;
    const slug = resolveSocialAppDocsSlug(row);
    if (!slug) continue;
    const key = slug.toLowerCase();
    const list = map.get(key) ?? [];
    list.push(row as OAuthSocialAppRow);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.id - b.id);
  }
  return map;
}

/** Whether a company may add more than one social app for this catalog provider. */
export function isMultiInstanceCatalogProvider(provider: OAuthCatalogProvider): boolean {
  if (typeof provider.multiple_allowed === 'boolean') {
    return provider.multiple_allowed;
  }
  if (provider.tier === 'generic') return true;
  return (GENERIC_PROVIDER_ORDER as readonly string[]).includes(provider.docs_slug);
}

/** Show "(N)" in picker section titles when a section has more than this many visible tiles. */
export const PICKER_SECTION_COUNT_THRESHOLD = 5;

const PICKER_SECTION_HEADING: Record<
  'popular' | 'generic' | 'other',
  { base: string; withCount: string }
> = {
  popular: {
    base: 'oauthWizardPopularHeading',
    withCount: 'oauthWizardPopularHeadingWithCount',
  },
  generic: {
    base: 'oauthWizardGenericHeading',
    withCount: 'oauthWizardGenericHeadingWithCount',
  },
  other: {
    base: 'oauthWizardOtherHeading',
    withCount: 'oauthWizardOtherHeadingWithCount',
  },
};

export function pickerSectionHeading(
  t: TFunction,
  section: 'popular' | 'generic' | 'other',
  visibleCount: number,
): string {
  const keys = PICKER_SECTION_HEADING[section];
  if (visibleCount > PICKER_SECTION_COUNT_THRESHOLD) {
    return t(keys.withCount, { count: visibleCount });
  }
  return t(keys.base);
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
