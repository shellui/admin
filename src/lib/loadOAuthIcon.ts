import {
  OAUTH_ICON_DARK_LOADERS,
  OAUTH_ICON_FALLBACK_SLUGS,
  OAUTH_ICON_LOADERS,
  OAUTH_ICON_META,
} from '@/assets/oauth-icons/oauthIconManifest';
import { normalizeOAuthDocsSlug } from '@/lib/oauthProviderResolve';

export { OAUTH_ICON_FALLBACK_SLUGS, OAUTH_ICON_META };

export function hasBundledOAuthIcon(docsSlug: string): boolean {
  const slug = normalizeOAuthDocsSlug(docsSlug);
  return Boolean(OAUTH_ICON_LOADERS[slug]);
}

export async function loadOAuthIconSvg(
  docsSlug: string,
  colorScheme: 'light' | 'dark',
): Promise<string | null> {
  const slug = normalizeOAuthDocsSlug(docsSlug);
  const useDark = colorScheme === 'dark' && OAUTH_ICON_DARK_LOADERS[slug];
  const loader = useDark ? OAUTH_ICON_DARK_LOADERS[slug] : OAUTH_ICON_LOADERS[slug];
  if (!loader) return null;
  try {
    const mod = await loader();
    return mod.default;
  } catch {
    return null;
  }
}
