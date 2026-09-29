import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import {
  consoleKindI18nKey,
  consoleUrlPresentation,
  splitConsoleUrlTemplate,
} from '@/lib/oauthConsoleUrlKind';

type Props = {
  provider: OAuthCatalogProvider;
};

export function OAuthConsoleUrlList({ provider }: Props) {
  const { t } = useTranslation();

  if (provider.console_url.length === 0) {
    return (
      <Text className="font-mono text-sm text-muted-foreground">
        {t('oauthWizardConsoleEmpty')}
      </Text>
    );
  }

  return (
    <div className="space-y-3">
      {provider.console_url.map((entry, index) => {
        const presentation = consoleUrlPresentation(entry);
        const key = `${entry.kind}-${entry.url}-${index}`;
        const buttonLabel = t(consoleKindI18nKey(entry.kind), { provider: provider.name });

        if (presentation === 'link') {
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
                {buttonLabel}
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
          );
        }

        if (presentation === 'template') {
          const segments = splitConsoleUrlTemplate(entry.url);
          return (
            <div
              key={key}
              className="space-y-2 rounded-md border border-dashed border-border/80 px-3 py-2"
            >
              <p className="font-mono text-xs text-foreground">{buttonLabel}</p>
              <p className="break-all font-mono text-xs leading-relaxed">
                {segments.map((seg, i) =>
                  seg.type === 'placeholder' ? (
                    <mark
                      key={i}
                      className="rounded bg-amber-200/80 px-0.5 font-semibold text-foreground dark:bg-amber-500/30"
                    >
                      {seg.value}
                    </mark>
                  ) : (
                    <span key={i}>{seg.value}</span>
                  ),
                )}
              </p>
              <Text className="font-mono text-[10px] text-muted-foreground">
                {t('oauthConsoleUrlTemplateHint')}
              </Text>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
