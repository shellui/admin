import { useEffect, useMemo, useState } from 'react';
import { KeyRound, LogIn } from 'lucide-react';
import type { OAuthCatalogProvider, OAuthProviderIcon } from '@/lib/oauthProviderCatalogTypes';
import { loadOAuthIconSvg, OAUTH_ICON_META, hasBundledOAuthIcon } from '@/lib/loadOAuthIcon';
import { protocolUsesKeyRoundFallback } from '@/lib/oauthProviderIconStyle';
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

  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

  useEffect(() => {
    if (!docsSlug || !hasBundledOAuthIcon(docsSlug)) {
      setSvgMarkup(null);
      return;
    }
    let cancelled = false;
    void loadOAuthIconSvg(docsSlug, colorScheme).then((raw) => {
      if (!cancelled) setSvgMarkup(raw);
    });
    return () => {
      cancelled = true;
    };
  }, [docsSlug, colorScheme]);

  const iconClass = cn(sizeClasses[size], className);
  const meta = OAUTH_ICON_META[docsSlug.toLowerCase()];

  const Fallback = useMemo(() => {
    const pick = lucideFallbackName(icon);
    if (pick === 'KeyRound' || protocolUsesKeyRoundFallback(protocol, docsSlug)) {
      return KeyRound;
    }
    return LogIn;
  }, [docsSlug, icon, protocol]);

  if (svgMarkup) {
    const invert = meta?.invertOnDark && colorScheme === 'dark';
    const fullColor = meta?.fullColor ?? true;
    const svgClass = cn('h-full w-full', invert && 'dark:brightness-0 dark:invert');
    return (
      <span
        className={cn('inline-flex shrink-0 items-center justify-center', iconClass)}
        role="img"
        aria-label={label}
        dangerouslySetInnerHTML={{
          __html: svgMarkup.replace(
            '<svg ',
            `<svg class="${svgClass}" ${fullColor ? '' : 'fill="currentColor"'} aria-hidden="true" `,
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
