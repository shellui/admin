import { useEffect, useId, useMemo, useState } from 'react';
import { sanitizeSvgInstancePrefix } from '@/lib/oauthSvgIds';
import { prepareOAuthInlineIconSvg } from '@/lib/oauthIconRender';
import { KeyRound, LogIn } from 'lucide-react';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { loadOAuthIconSvg, OAUTH_ICON_META, hasBundledOAuthIcon } from '@/lib/loadOAuthIcon';
import { docsSlugForCatalogProvider, normalizeOAuthDocsSlug } from '@/lib/oauthProviderResolve';
import { protocolUsesKeyRoundFallback } from '@/lib/oauthProviderIconStyle';
import { cn } from '@/lib/utils';

export type OAuthProviderIconProps = {
  docsSlug: string;
  protocol?: string;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  colorScheme?: 'light' | 'dark';
};

/** @deprecated Pass `docsSlug` via {@link OAuthProviderIcon} instead of a full catalog row. */
type LegacyProps = {
  provider?: Pick<OAuthCatalogProvider, 'docs_slug' | 'protocol' | 'name'>;
  docsSlug?: string;
  protocol?: string;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  colorScheme?: 'light' | 'dark';
};

const sizeClasses = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
};

export function OAuthProviderIcon({
  docsSlug: docsSlugProp,
  protocol: protocolProp = '',
  title,
  size = 'md',
  className,
  colorScheme = 'light',
}: OAuthProviderIconProps) {
  const iconSlug = normalizeOAuthDocsSlug(docsSlugProp);
  const label = title ?? iconSlug;
  const instancePrefix = sanitizeSvgInstancePrefix(useId());

  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

  useEffect(() => {
    if (!iconSlug || !hasBundledOAuthIcon(iconSlug)) {
      setSvgMarkup(null);
      return;
    }
    let cancelled = false;
    void loadOAuthIconSvg(iconSlug, colorScheme).then((raw) => {
      if (!cancelled) setSvgMarkup(raw);
    });
    return () => {
      cancelled = true;
    };
  }, [iconSlug, colorScheme]);

  const iconClass = cn(sizeClasses[size], className);
  const meta = OAUTH_ICON_META[iconSlug];

  const Fallback = useMemo(() => {
    if (protocolUsesKeyRoundFallback(protocolProp, iconSlug)) {
      return KeyRound;
    }
    return LogIn;
  }, [iconSlug, protocolProp]);

  const scopedSvg = useMemo(() => {
    if (!svgMarkup) return null;
    return prepareOAuthInlineIconSvg({
      svgMarkup,
      instancePrefix,
      meta,
      colorScheme,
    });
  }, [svgMarkup, instancePrefix, meta, colorScheme]);

  if (scopedSvg) {
    return (
      <span
        className={cn('inline-flex shrink-0 items-center justify-center', iconClass)}
        role="img"
        aria-label={label}
        data-oauth-icon-slug={iconSlug}
        dangerouslySetInnerHTML={{ __html: scopedSvg }}
      />
    );
  }

  return (
    <Fallback
      className={cn(iconClass, 'text-muted-foreground')}
      aria-label={label}
      data-oauth-icon-slug={iconSlug}
    />
  );
}

/** Catalog-aware wrapper: resolves `docs_slug` from a picker/wizard provider row. */
export function OAuthProviderIconFromCatalog({
  provider,
  size,
  className,
  colorScheme,
}: {
  provider: Pick<OAuthCatalogProvider, 'docs_slug' | 'protocol' | 'name'>;
  size?: OAuthProviderIconProps['size'];
  className?: string;
  colorScheme?: 'light' | 'dark';
}) {
  return (
    <OAuthProviderIcon
      docsSlug={docsSlugForCatalogProvider(provider)}
      protocol={provider.protocol}
      title={provider.name}
      size={size}
      className={className}
      colorScheme={colorScheme}
    />
  );
}

/** @deprecated Use {@link OAuthProviderIcon} or {@link OAuthProviderIconFromCatalog}. */
export function OAuthProviderIconView({
  provider,
  docsSlug: docsSlugProp,
  protocol: protocolProp,
  title,
  size,
  className,
  colorScheme,
}: LegacyProps) {
  const docsSlug = docsSlugProp ?? (provider ? docsSlugForCatalogProvider(provider) : '');
  const protocol = protocolProp ?? provider?.protocol ?? '';
  const label = title ?? provider?.name;
  return (
    <OAuthProviderIcon
      docsSlug={docsSlug}
      protocol={protocol}
      title={label}
      size={size}
      className={className}
      colorScheme={colorScheme}
    />
  );
}
