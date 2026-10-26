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
    <div
      className="tone-gold space-y-2 rounded-xl border p-4"
      role="status"
    >
      <p className="text-sm font-semibold text-foreground">{t('webhooksSecretOnceTitle')}</p>
      <p className="text-[13px] text-foreground">{t('webhooksSecretOnceNote')}</p>
      <p className="text-xs text-muted-foreground">{t('webhooksSecretN8nHint')}</p>
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
