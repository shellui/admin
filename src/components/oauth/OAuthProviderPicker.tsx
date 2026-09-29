import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import {
  configuredProviderSlugs,
  isProviderConfigured,
  partitionProvidersForPicker,
  pickerHasAnyProvider,
  pickerSectionHeading,
} from '@/lib/oauthSetupView';
import type { OAuthSocialAppRow } from '@/lib/adminOauthClientsApi';
import { OAuthProviderIconFromCatalog } from '@/components/oauth/OAuthProviderIcon';
import { cn } from '@/lib/utils';

type Props = {
  providers: OAuthCatalogProvider[];
  socialApps: OAuthSocialAppRow[];
  onSelect: (provider: OAuthCatalogProvider) => void;
  colorScheme?: 'light' | 'dark';
};

export function OAuthProviderPicker({
  providers,
  socialApps,
  onSelect,
  colorScheme = 'light',
}: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const configured = useMemo(() => configuredProviderSlugs(socialApps), [socialApps]);
  const sections = useMemo(
    () => partitionProvidersForPicker(providers, { searchQuery: search }),
    [providers, search],
  );
  const hasAny = pickerHasAnyProvider(sections);

  function renderTile(provider: OAuthCatalogProvider, large: boolean) {
    const configuredMark = isProviderConfigured(provider, configured);
    return (
      <button
        key={provider.docs_slug}
        type="button"
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border border-border/80 p-3 text-center transition-colors',
          large ? 'min-h-[7rem]' : 'min-h-[4.5rem] p-2',
          'hover:border-primary/40 hover:bg-muted/40',
        )}
        onClick={() => onSelect(provider)}
      >
        <OAuthProviderIconFromCatalog
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
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('oauthWizardSearchPlaceholder')}
          className="font-mono text-sm"
          aria-label={t('oauthWizardSearchPlaceholder')}
        />
      </div>

      {!hasAny ? (
        <Text className="font-mono text-sm text-muted-foreground">
          {t('oauthWizardSearchEmpty')}
        </Text>
      ) : null}

      {sections.popular.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {pickerSectionHeading(t, 'popular', sections.popular.length)}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {sections.popular.map((p) => renderTile(p, true))}
          </div>
        </section>
      ) : null}

      {sections.generic.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {pickerSectionHeading(t, 'generic', sections.generic.length)}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {sections.generic.map((p) => renderTile(p, true))}
          </div>
        </section>
      ) : null}

      {sections.other.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {pickerSectionHeading(t, 'other', sections.other.length)}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {sections.other.map((p) => renderTile(p, false))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
