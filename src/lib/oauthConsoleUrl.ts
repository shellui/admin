import type { OAuthConsoleUrlEntry } from '@/lib/oauthProviderCatalogTypes';
import { consoleUrlHasPlaceholder, consoleUrlPresentation } from '@/lib/oauthConsoleUrlKind';

export { consoleUrlHasPlaceholder };

/** @deprecated Use consoleUrlPresentation(entry) === 'link' */
export function isConsoleUrlLinkable(entry: OAuthConsoleUrlEntry): boolean {
  return consoleUrlPresentation(entry) === 'link';
}

/** @deprecated Never show legacy catalog copy in UI */
export function consoleUrlHintText(_entry: OAuthConsoleUrlEntry): string {
  return '';
}
