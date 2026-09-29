import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';

type Props = {
  callbackUrl: string;
  description?: string;
};

export function OAuthCallbackUrlCopy({ callbackUrl, description }: Props) {
  const { t } = useTranslation();
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');

  const onCopy = useCallback(async () => {
    if (!callbackUrl) return;
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
  }, [callbackUrl]);

  return (
    <div className="space-y-2 rounded-md border border-border/70 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {t('oauthWizardCallbackLabel')}
      </p>
      {description ? (
        <p className="font-mono text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={callbackUrl}
          readOnly
          className="font-mono text-xs"
          aria-label={t('oauthWizardCallbackLabel')}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void onCopy()}
        >
          {copyState === 'done' ? t('oauthWizardCopied') : t('oauthWizardCopy')}
        </Button>
      </div>
      {copyState === 'error' ? (
        <Text className="font-mono text-xs text-destructive">{t('oauthWizardCopyError')}</Text>
      ) : null}
    </div>
  );
}
