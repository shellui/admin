import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { consoleUrlHintText, isConsoleUrlLinkable } from '@/lib/oauthConsoleUrl';
import { OAuthCallbackUrlCopy } from '@/components/oauth/OAuthCallbackUrlCopy';
import { OAuthProviderIconView } from '@/components/oauth/OAuthProviderIcon';

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

      <Text className="font-mono text-sm">{t('oauthWizardConsoleIntro')}</Text>

      <div className="space-y-3">
        {provider.console_url.length === 0 ? (
          <Text className="font-mono text-sm text-muted-foreground">
            {t('oauthWizardConsoleEmpty')}
          </Text>
        ) : null}
        {provider.console_url.map((entry, index) => {
          const linkable = isConsoleUrlLinkable(entry);
          const key = `${entry.url}-${index}`;
          if (linkable) {
            return (
              <Button
                key={key}
                type="button"
                variant="secondary"
                size="sm"
                className="font-mono text-xs"
                asChild
              >
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {entry.label || entry.text || entry.url}
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            );
          }
          return (
            <div
              key={key}
              className="rounded-md border border-dashed border-border/80 px-3 py-2"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {entry.label || t('oauthWizardConsoleHint')}
              </p>
              <p className="break-all font-mono text-xs">{consoleUrlHintText(entry)}</p>
            </div>
          );
        })}
      </div>

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

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
        >
          {t('oauthWizardBack')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onContinue}
        >
          {t('oauthWizardContinueCredentials')}
        </Button>
      </div>
    </div>
  );
}
