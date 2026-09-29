import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { OAuthCallbackUrlCopy } from '@/components/oauth/OAuthCallbackUrlCopy';
import { OAuthConsoleUrlList } from '@/components/oauth/OAuthConsoleUrlList';
import { OAuthProviderIconView } from '@/components/oauth/OAuthProviderIcon';
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
      <Link
        to="/oauth"
        className="inline-flex items-center font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft
          className="mr-0.5 h-3.5 w-3.5"
          aria-hidden
        />
        {t('oauthWizardBackToList')}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <OAuthProviderIconView
          provider={provider}
          size="lg"
          colorScheme={colorScheme}
        />
        <div>
          <h2 className="font-heading text-lg font-semibold">{provider.name}</h2>
          <Text className="font-mono text-xs text-muted-foreground">{provider.protocol}</Text>
        </div>
      </div>

      <Text className="font-mono text-sm">
        {t('oauthWizardConsoleIntro', { provider: provider.name })}
      </Text>

      <OAuthConsoleUrlList provider={provider} />

      {provider.docs_url ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-mono text-xs"
          asChild
        >
          <a
            href={provider.docs_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('oauthWizardAllauthDocs')}
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
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
