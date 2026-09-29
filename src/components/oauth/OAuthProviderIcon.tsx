import { useEffect, useMemo, useState } from 'react';
import { KeyRound, LogIn } from 'lucide-react';
import type { OAuthCatalogProvider, OAuthProviderIcon } from '@/lib/oauthProviderCatalogTypes';
import { loadSimpleIconSvg } from '@/lib/oauthSimpleIconLoaders';
import {
  protocolUsesKeyRoundFallback,
  shouldUseBrandIconColor,
} from '@/lib/oauthProviderIconStyle';
import { cn } from '@/lib/utils';

type Props = {
  provider?: Pick<OAuthCatalogProvider, 'docs_slug' | 'protocol' | 'icon' | 'name'>;
  icon?: OAuthProviderIcon;
  protocol?: string;
  docsSlug?: string;
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

function lucideFallbackName(icon: OAuthProviderIcon | undefined): 'KeyRound' | 'LogIn' {
  const fallback =
    icon && typeof icon === 'object' && 'fallback' in icon
      ? (icon as { fallback?: { lucide?: string } }).fallback
      : undefined;
  const name = fallback?.lucide;
  if (name === 'KeyRound') return 'KeyRound';
  return 'LogIn';
}

export function OAuthProviderIconView({
  provider,
  icon: iconProp,
  protocol: protocolProp,
  docsSlug: docsSlugProp,
  title,
  size = 'md',
  className,
  colorScheme = 'light',
}: Props) {
  const icon = iconProp ?? provider?.icon;
  const protocol = protocolProp ?? provider?.protocol ?? '';
  const docsSlug = docsSlugProp ?? provider?.docs_slug ?? '';
  const label = title ?? provider?.name ?? docsSlug;

  const simpleSlug =
    icon && typeof icon === 'object' && icon.source === 'simple-icons' && 'slug' in icon
      ? String(icon.slug)
      : null;
  const brandHex =
    icon && typeof icon === 'object' && icon.source === 'simple-icons' && 'hex' in icon
      ? String(icon.hex)
      : undefined;

  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

  useEffect(() => {
    if (!simpleSlug) {
      setSvgMarkup(null);
      return;
    }
    let cancelled = false;
    void loadSimpleIconSvg(simpleSlug).then((raw) => {
      if (!cancelled) setSvgMarkup(raw);
    });
    return () => {
      cancelled = true;
    };
  }, [simpleSlug]);

  const useBrand = shouldUseBrandIconColor(brandHex, colorScheme);
  const iconClass = cn(sizeClasses[size], className);

  const Fallback = useMemo(() => {
    const pick = lucideFallbackName(icon);
    if (pick === 'KeyRound' || protocolUsesKeyRoundFallback(protocol, docsSlug)) {
      return KeyRound;
    }
    return LogIn;
  }, [docsSlug, icon, protocol]);

  if (svgMarkup) {
    const colored = useBrand && brandHex ? `#${brandHex.replace(/^#/, '')}` : 'currentColor';
    return (
      <span
        className={cn('inline-flex shrink-0 items-center justify-center', iconClass)}
        style={{ color: colored }}
        role="img"
        aria-label={label}
        dangerouslySetInnerHTML={{
          __html: svgMarkup.replace(
            '<svg ',
            `<svg class="h-full w-full" fill="currentColor" aria-hidden="true" `,
          ),
        }}
      />
    );
  }

  return (
    <Fallback
      className={cn(iconClass, 'text-muted-foreground')}
      aria-label={label}
    />
  );
}
