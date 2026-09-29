import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import {
  isMultiInstanceCatalogProvider,
  linkedSocialAppsByDocsSlug,
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
  onAdd: (provider: OAuthCatalogProvider) => void;
  onOpenApp: (appId: number) => void;
  colorScheme?: 'light' | 'dark';
};

export function OAuthProviderPicker({
  providers,
  socialApps,
  onAdd,
  onOpenApp,
  colorScheme = 'light',
}: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const appsBySlug = useMemo(() => linkedSocialAppsByDocsSlug(socialApps), [socialApps]);
  const sections = useMemo(
    () => partitionProvidersForPicker(providers, { searchQuery: search }),
    [providers, search],
  );
  const hasAny = pickerHasAnyProvider(sections);

  function renderTile(provider: OAuthCatalogProvider, large: boolean) {
    const slugKey = provider.docs_slug.toLowerCase();
    const linkedApps = appsBySlug.get(slugKey) ?? [];
    const multi = isMultiInstanceCatalogProvider(provider);
    const singleConfigured = !multi && linkedApps.length > 0;
    const multiConfigured = multi && linkedApps.length > 0;

    const tileClass = cn(
      'flex flex-col items-center gap-2 rounded-lg border border-border/80 p-3 text-center transition-colors',
      large ? 'min-h-[7rem]' : 'min-h-[4.5rem] p-2',
      'hover:border-primary/40 hover:bg-muted/40',
    );

    const iconBlock = (
      <>
        <OAuthProviderIconFromCatalog
          provider={provider}
          size={large ? 'lg' : 'md'}
          colorScheme={colorScheme}
        />
        <span className="font-mono text-[11px] leading-tight">{provider.name}</span>
      </>
    );

    if (singleConfigured) {
      const app = linkedApps[0];
      return (
        <button
          key={provider.docs_slug}
          type="button"
          className={tileClass}
          aria-label={t('oauthWizardConfiguredOpensSettings', { provider: provider.name })}
          onClick={() => onOpenApp(app.id)}
        >
          {iconBlock}
          <Badge
            variant="secondary"
            className="font-mono text-[9px]"
          >
            {t('oauthWizardConfiguredBadge')}
          </Badge>
        </button>
      );
    }

    const badge = multiConfigured ? (
      <Badge
        variant="secondary"
        className="font-mono text-[9px]"
      >
        {t('oauthWizardConfiguredCount', { count: linkedApps.length })}
      </Badge>
    ) : null;

    const existingLinks = multiConfigured ? (
      <div className="flex w-full flex-col gap-1 pt-1">
        {linkedApps.map((app) => (
          <Link
            key={app.id}
            to={`/oauth/apps/${app.id}/edit`}
            className="font-mono text-[10px] text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {t('oauthWizardOpenExistingApp', { name: app.name || provider.name })}
          </Link>
        ))}
      </div>
    ) : null;

    if (!multiConfigured) {
      return (
        <button
          key={provider.docs_slug}
          type="button"
          className={tileClass}
          aria-label={t('oauthWizardAddProviderTile', { provider: provider.name })}
          onClick={() => onAdd(provider)}
        >
          {iconBlock}
        </button>
      );
    }

    return (
      <div
        key={provider.docs_slug}
        className={cn(tileClass, 'gap-1')}
      >
        <button
          type="button"
          className="flex w-full flex-col items-center gap-2"
          aria-label={t('oauthWizardMultiConfiguredTile', {
            provider: provider.name,
            count: linkedApps.length,
          })}
          onClick={() => onAdd(provider)}
        >
          {iconBlock}
          {badge}
        </button>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 font-mono text-[10px]"
          onClick={() => onAdd(provider)}
        >
          {t('oauthWizardAddAnotherInstance')}
        </Button>
        {existingLinks}
      </div>
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
