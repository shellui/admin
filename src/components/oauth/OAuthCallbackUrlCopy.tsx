import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
      <p className="text-sm font-medium">{t('oauthWizardCallbackLabel')}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={callbackUrl}
          readOnly
          className="font-mono text-xs"
          aria-label={t('oauthWizardCallbackLabel')}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void onCopy()}
        >
          {copyState === 'done' ? t('oauthWizardCopied') : t('oauthWizardCopy')}
        </Button>
      </div>
      {copyState === 'error' ? (
        <p className="text-xs text-destructive">{t('oauthWizardCopyError')}</p>
      ) : null}
    </div>
  );
}
