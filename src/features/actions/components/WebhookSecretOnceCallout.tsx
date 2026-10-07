import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';

type Props = {
  secret: string;
  onDismiss?: () => void;
};

export function WebhookSecretOnceCallout({ secret, onDismiss }: Props) {
  const { t } = useTranslation();
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
      <p className="font-mono text-xs font-semibold text-amber-950 dark:text-amber-100">
        {t('webhooksSecretOnceTitle')}
      </p>
      <p className="font-mono text-[10px] text-amber-950/90 dark:text-amber-100/90">
        {t('webhooksSecretOnceNote')}
      </p>
      <p className="font-mono text-[10px] text-muted-foreground">{t('webhooksSecretN8nHint')}</p>
      <Input
        value={secret}
        readOnly
        className="font-mono text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void onCopy()}
        >
          {copyState === 'done' ? t('webhooksSecretCopied') : t('webhooksSecretCopy')}
        </Button>
        {onDismiss ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onDismiss}
          >
            {t('webhooksSecretDismiss')}
          </Button>
        ) : null}
      </div>
      {copyState === 'error' ? (
        <Text className="font-mono text-xs text-destructive">{t('webhooksSecretCopyError')}</Text>
      ) : null}
    </div>
  );
}
