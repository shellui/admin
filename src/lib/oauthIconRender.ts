import { prefixSvgDocumentIds } from '@/lib/oauthSvgIds';
import type { OAuthIconMeta } from '@/assets/oauth-icons/oauthIconManifest';
import { cn } from '@/lib/utils';

type PrepareOptions = {
  svgMarkup: string;
  instancePrefix: string;
  meta?: OAuthIconMeta;
  colorScheme: 'light' | 'dark';
};

/** Inline SVG string ready for dangerouslySetInnerHTML. */
export function prepareOAuthInlineIconSvg({
  svgMarkup,
  instancePrefix,
  meta,
  colorScheme,
}: PrepareOptions): string {
  const withInstanceIds = prefixSvgDocumentIds(svgMarkup, instancePrefix);
  const fullColor = meta?.fullColor ?? true;
  const invert = meta?.invertOnDark && colorScheme === 'dark';
  const svgClass = cn(
    'h-full w-full',
    fullColor ? 'oauth-icon-full-color' : 'oauth-icon-monochrome',
    invert && 'dark:brightness-0 dark:invert',
  );
  const rootFill = fullColor ? '' : ' fill="currentColor"';
  return withInstanceIds.replace(
    '<svg ',
    `<svg class="${svgClass}"${rootFill} aria-hidden="true" `,
  );
}
