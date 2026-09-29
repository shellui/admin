import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import { useShelluiAuthBackendBaseUrl } from '@/hooks/useShelluiAuthBackendBaseUrl';
import { useShelluiHosting } from '@/hooks/useShelluiHosting';
import { useShelluiStorage } from '@/hooks/useShelluiStorage';
import { useWebhookServices } from '@/features/actions/useWebhookServices';
import { resolveWebhookServiceFromPathname } from '@/lib/webhookRoutePaths';
import {
  listConfiguredWebhookServices,
  resolveWebhookServiceBaseUrl,
  type WebhookServiceDefinition,
  type WebhookServiceKey,
} from '@/lib/webhookServices';

const STATIC_DEFS: Record<WebhookServiceKey, Omit<WebhookServiceDefinition, 'baseUrl'>> = {
  identity: {
    key: 'identity',
    labelKey: 'webhooksServiceIdentity',
    badgeKey: 'webhooksBadgeIdentity',
    pageTitleKey: 'webhooksPageTitleIdentity',
    deliveriesPageTitleKey: 'webhooksDeliveriesPageTitleIdentity',
    descriptionKey: 'webhooksPageDescriptionIdentity',
    eventScopeKey: 'webhooksEventScopeIdentity',
  },
  hosting: {
    key: 'hosting',
    labelKey: 'webhooksServiceHosting',
    badgeKey: 'webhooksBadgeHosting',
    pageTitleKey: 'webhooksPageTitleHosting',
    deliveriesPageTitleKey: 'webhooksDeliveriesPageTitleHosting',
    descriptionKey: 'webhooksPageDescriptionHosting',
    eventScopeKey: 'webhooksEventScopeHosting',
  },
  storage: {
    key: 'storage',
    labelKey: 'webhooksServiceStorage',
    badgeKey: 'webhooksBadgeStorage',
    pageTitleKey: 'webhooksPageTitleStorage',
    deliveriesPageTitleKey: 'webhooksDeliveriesPageTitleStorage',
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

/** All service definitions (including unconfigured) for tests. */
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
