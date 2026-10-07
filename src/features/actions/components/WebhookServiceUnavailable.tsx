import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import type { WebhookServiceKey } from '@/lib/webhookServices';

const CONFIG_HINT_KEYS: Record<
  WebhookServiceKey,
  | 'webhooksServiceNotConfiguredIdentity'
  | 'webhooksServiceNotConfiguredHosting'
  | 'webhooksServiceNotConfiguredStorage'
> = {
  identity: 'webhooksServiceNotConfiguredIdentity',
  hosting: 'webhooksServiceNotConfiguredHosting',
  storage: 'webhooksServiceNotConfiguredStorage',
};

export function WebhookServiceUnavailable({ serviceKey }: { serviceKey: WebhookServiceKey }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-6">
      <Text className="font-mono text-sm text-muted-foreground">
        {t(CONFIG_HINT_KEYS[serviceKey])}
      </Text>
    </div>
  );
}
