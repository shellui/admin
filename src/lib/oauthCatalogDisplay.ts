import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';

/** Providers shown in the admin picker (supported, non-legacy). */
export function visibleCatalogProviders(
  providers: ReadonlyArray<OAuthCatalogProvider>,
): OAuthCatalogProvider[] {
  return providers.filter((p) => p.supported && !p.legacy);
}
