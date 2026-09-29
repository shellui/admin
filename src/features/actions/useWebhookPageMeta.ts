import { useLocation } from 'react-router-dom';
import { useWebhookServices } from '@/features/actions/useWebhookServices';
import { resolveWebhookServiceFromPathname } from '@/lib/webhookRoutePaths';
import {
  listConfiguredWebhookServices,
  resolveWebhookServiceBaseUrl,
  type WebhookServiceDefinition,
  type WebhookServiceKey,
} from '@/lib/webhookServices';
import { useShelluiAuthBackendBaseUrl } from '@/hooks/useShelluiAuthBackendBaseUrl';
import { useShelluiHosting } from '@/hooks/useShelluiHosting';
import { useShelluiStorage } from '@/hooks/useShelluiStorage';
import { useMemo } from 'react';
import { getAuthBackendBaseUrl } from '@/lib/backendUrl';

const STATIC_DEFS: Record<WebhookServiceKey, Omit<WebhookServiceDefinition, 'baseUrl'>> = {
  identity: {
    key: 'identity',
    labelKey: 'webhooksServiceIdentity',
    badgeKey: 'webhooksBadgeIdentity',
    descriptionKey: 'webhooksPageDescriptionIdentity',
    eventScopeKey: 'webhooksEventScopeIdentity',
  },
  hosting: {
    key: 'hosting',
    labelKey: 'webhooksServiceHosting',
    badgeKey: 'webhooksBadgeHosting',
    descriptionKey: 'webhooksPageDescriptionHosting',
    eventScopeKey: 'webhooksEventScopeHosting',
  },
  storage: {
    key: 'storage',
    labelKey: 'webhooksServiceStorage',
    badgeKey: 'webhooksBadgeStorage',
    descriptionKey: 'webhooksPageDescriptionStorage',
    eventScopeKey: 'webhooksEventScopeStorage',
  },
};

export function useWebhookPageMeta(): {
  service: WebhookServiceDefinition;
  serviceConfigured: boolean;
} {
  const { pathname } = useLocation();
  const serviceKey = resolveWebhookServiceFromPathname(pathname);
  const identityBaseUrl = useShelluiAuthBackendBaseUrl();
  const hosting = useShelluiHosting();
  const storage = useShelluiStorage();
  const { services } = useWebhookServices();

  const shellOptions = useMemo(
    () => ({
      identityBaseUrl: identityBaseUrl ?? getAuthBackendBaseUrl(),
      hosting,
      storage,
    }),
    [hosting, identityBaseUrl, storage],
  );

  const configured = services.find((s) => s.key === serviceKey);
  const baseUrl = resolveWebhookServiceBaseUrl(serviceKey, shellOptions);

  const service: WebhookServiceDefinition = configured ?? {
    ...STATIC_DEFS[serviceKey],
    baseUrl,
  };

  return { service, serviceConfigured: Boolean(baseUrl) };
}

/** All service definitions (including unconfigured) for tests and docs. */
export function allWebhookServiceDefinitions(options: {
  identityBaseUrl?: string | null;
  hosting?: Parameters<typeof listConfiguredWebhookServices>[0]['hosting'];
  storage?: Parameters<typeof listConfiguredWebhookServices>[0]['storage'];
}): WebhookServiceDefinition[] {
  return (['identity', 'hosting', 'storage'] as WebhookServiceKey[]).map((key) => ({
    ...STATIC_DEFS[key],
    baseUrl: resolveWebhookServiceBaseUrl(key, options),
  }));
}
