import { useMemo } from 'react';
import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import { useShelluiAuthBackendBaseUrl } from '@/hooks/useShelluiAuthBackendBaseUrl';
import { useShelluiHosting } from '@/hooks/useShelluiHosting';
import { useShelluiStorage } from '@/hooks/useShelluiStorage';
import {
  listConfiguredWebhookServices,
  resolveWebhookServiceBaseUrl,
  type WebhookServiceDefinition,
  type WebhookServiceKey,
} from '@/lib/webhookServices';

export function useWebhookServices(): {
  services: WebhookServiceDefinition[];
  getBaseUrl: (key: WebhookServiceKey) => string | null;
} {
  const identityBaseUrl = useShelluiAuthBackendBaseUrl();
  const hosting = useShelluiHosting();
  const storage = useShelluiStorage();

  const options = useMemo(
    () => ({
      identityBaseUrl: identityBaseUrl ?? getAuthBackendBaseUrl(),
      hosting,
      storage,
    }),
    [hosting, identityBaseUrl, storage],
  );

  const services = useMemo(() => listConfiguredWebhookServices(options), [options]);

  const getBaseUrl = useMemo(
    () => (key: WebhookServiceKey) => resolveWebhookServiceBaseUrl(key, options),
    [options],
  );

  return { services, getBaseUrl };
}
