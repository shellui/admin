import type { OAuthSocialAppRow } from '@/lib/adminOauthClientsApi';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';

/** Map allauth / legacy provider ids to catalog `docs_slug` (icon + catalog lookup). */
export const OAUTH_DOCS_SLUG_ALIASES: Record<string, string> = {
  windowslive: 'microsoft',
};

export type OAuthCatalogIndex = {
  byDocsSlug: ReadonlyMap<string, OAuthCatalogProvider>;
};

export function normalizeOAuthDocsSlug(raw: string): string {
  const slug = String(raw || '')
    .trim()
    .toLowerCase();
  if (!slug) return '';
  return OAUTH_DOCS_SLUG_ALIASES[slug] ?? slug;
}

export function readSocialAppCatalogSlug(settings: OAuthSocialAppRow['settings']): string | null {
  if (!settings || typeof settings !== 'object') return null;
  const slug = (settings as Record<string, unknown>).catalog_slug;
  if (typeof slug === 'string' && slug.trim()) return slug.trim().toLowerCase();
  return null;
}

export type SocialAppCatalogHint = Pick<
  OAuthSocialAppRow,
  'provider' | 'allauth_provider' | 'provider_id' | 'settings'
>;

/** Resolve the catalog `docs_slug` used for icons and wizard steps. */
export function resolveSocialAppDocsSlug(row: SocialAppCatalogHint): string {
  const fromSettings = readSocialAppCatalogSlug(row.settings);
  if (fromSettings) return normalizeOAuthDocsSlug(fromSettings);

  const candidates = [row.provider, row.allauth_provider, row.provider_id].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );

  for (const raw of candidates) {
    return normalizeOAuthDocsSlug(raw);
  }
  return '';
}

export function buildOAuthCatalogIndex(
  providers: ReadonlyArray<OAuthCatalogProvider>,
): OAuthCatalogIndex {
  const byDocsSlug = new Map<string, OAuthCatalogProvider>();
  for (const p of providers) {
    byDocsSlug.set(p.docs_slug.toLowerCase(), p);
  }
  return { byDocsSlug };
}

export function catalogProviderForSocialApp(
  row: SocialAppCatalogHint,
  index: OAuthCatalogIndex,
): OAuthCatalogProvider | undefined {
  const resolved = resolveSocialAppDocsSlug(row);
  if (resolved) {
    const hit = index.byDocsSlug.get(resolved);
    if (hit) return hit;
  }
  for (const raw of [row.provider, row.allauth_provider, row.provider_id]) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const key = raw.trim().toLowerCase();
    const hit = index.byDocsSlug.get(key) ?? index.byDocsSlug.get(normalizeOAuthDocsSlug(key));
    if (hit) return hit;
  }
  return undefined;
}

export function docsSlugForCatalogProvider(
  provider: Pick<OAuthCatalogProvider, 'docs_slug'>,
): string {
  return normalizeOAuthDocsSlug(provider.docs_slug);
}
