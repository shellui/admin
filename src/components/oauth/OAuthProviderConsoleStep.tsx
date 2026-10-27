import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { OAuthCallbackUrlCopy } from '@/components/oauth/OAuthCallbackUrlCopy';
import { OAuthConsoleUrlList } from '@/components/oauth/OAuthConsoleUrlList';
import { OAuthProviderIconFromCatalog } from '@/components/oauth/OAuthProviderIcon';
import { OAuthWizardStepActions } from '@/components/oauth/OAuthWizardStepActions';

type Props = {
  provider: OAuthCatalogProvider;
  callbackUrl: string;
  onBack: () => void;
  onContinue: () => void;
  colorScheme?: 'light' | 'dark';
};

export function OAuthProviderConsoleStep({
  provider,
  callbackUrl,
  onBack,
  onContinue,
  colorScheme = 'light',
}: Props) {
  const { t } = useTranslation();
  const effectiveCallback = callbackUrl || provider.callback_url;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <OAuthProviderIconFromCatalog
          provider={provider}
          size="lg"
          colorScheme={colorScheme}
        />
        <div>
          <h2 className="font-heading text-lg font-semibold">{provider.name}</h2>
          <p className="font-mono text-xs text-muted-foreground">{provider.protocol}</p>
        </div>
      </div>

      <p className="max-w-2xl text-sm">
        {t('oauthWizardConsoleIntro', { provider: provider.name })}
      </p>

      <OAuthConsoleUrlList provider={provider} />

      {provider.docs_url ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          asChild
        >
          <a
            href={provider.docs_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('oauthWizardAllauthDocs')}
            <ExternalLink
              aria-hidden
              className="size-3.5"
            />
            <span className="sr-only">{t('navOpensExternally')}</span>
          </a>
        </Button>
      ) : null}

      <OAuthCallbackUrlCopy
        callbackUrl={effectiveCallback}
        description={t('oauthWizardCallbackHelp')}
      />

      <OAuthWizardStepActions
        backLabel={t('oauthWizardBack')}
        onBack={onBack}
        primaryLabel={t('oauthWizardContinueCredentials')}
        onPrimary={onContinue}
      />
    </div>
  );
}
