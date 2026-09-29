import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import {
  configuredProviderSlugs,
  isProviderConfigured,
  partitionProvidersForPicker,
} from '@/lib/oauthSetupView';
import type { OAuthSocialAppRow } from '@/lib/adminOauthClientsApi';
import { OAuthProviderIconView } from '@/components/oauth/OAuthProviderIcon';
import { cn } from '@/lib/utils';

type Props = {
  providers: OAuthCatalogProvider[];
  socialApps: OAuthSocialAppRow[];
  includeLegacy: boolean;
  onIncludeLegacyChange: (next: boolean) => void;
  onSelect: (provider: OAuthCatalogProvider) => void;
  colorScheme?: 'light' | 'dark';
};

export function OAuthProviderPicker({
  providers,
  socialApps,
  includeLegacy,
  onIncludeLegacyChange,
  onSelect,
  colorScheme = 'light',
}: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const configured = useMemo(() => configuredProviderSlugs(socialApps), [socialApps]);
  const sections = useMemo(
    () =>
      partitionProvidersForPicker(providers, {
        includeLegacy,
        searchQuery: search,
      }),
    [providers, includeLegacy, search],
  );

  function renderTile(provider: OAuthCatalogProvider, large: boolean) {
    const configuredMark = isProviderConfigured(provider, configured);
    const disabled = !provider.supported;
    return (
      <button
        key={provider.docs_slug}
        type="button"
        disabled={disabled}
        title={disabled ? (provider.unsupported_reason ?? undefined) : undefined}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border border-border/80 p-3 text-center transition-colors',
          large ? 'min-h-[7rem]' : 'min-h-[4.5rem] p-2',
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-primary/40 hover:bg-muted/40',
        )}
        onClick={() => {
          if (!disabled) onSelect(provider);
        }}
      >
        <OAuthProviderIconView
          provider={provider}
          size={large ? 'lg' : 'md'}
          colorScheme={colorScheme}
        />
        <span className="font-mono text-[11px] leading-tight">{provider.name}</span>
        {configuredMark ? (
          <Badge
            variant="secondary"
            className="font-mono text-[9px]"
          >
            {t('oauthWizardConfiguredBadge')}
          </Badge>
        ) : null}
        {provider.legacy && provider.replaced_by ? (
          <span className="font-mono text-[9px] text-muted-foreground">
            {t('oauthWizardReplacedBy', { slug: provider.replaced_by })}
          </span>
        ) : null}
        {disabled && provider.unsupported_reason ? (
          <span className="font-mono text-[9px] text-muted-foreground">
            {provider.unsupported_reason}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 font-mono text-xs">
          <input
            type="checkbox"
            checked={includeLegacy}
            onChange={(e) => onIncludeLegacyChange(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          {t('oauthWizardShowLegacy')}
        </label>
      </div>

      {sections.popular.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {t('oauthWizardPopularHeading')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {sections.popular.map((p) => renderTile(p, true))}
          </div>
        </section>
      ) : null}

      {sections.generic.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {t('oauthWizardGenericHeading')}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {sections.generic.map((p) => renderTile(p, true))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {t('oauthWizardOtherHeading')}
          </h2>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('oauthWizardSearchPlaceholder')}
            className="max-w-xs font-mono text-xs"
            aria-label={t('oauthWizardSearchPlaceholder')}
          />
        </div>
        {sections.other.length === 0 ? (
          <Text className="font-mono text-sm text-muted-foreground">
            {t('oauthWizardSearchEmpty')}
          </Text>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {sections.other.map((p) => renderTile(p, false))}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSearch('')}
          disabled={!search.trim()}
        >
          {t('oauthWizardClearSearch')}
        </Button>
      </div>
    </div>
  );
}
