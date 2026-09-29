import { isHostingAdminEnabled, type SettingsHosting } from '@/hooks/useShelluiHosting';
import type { SettingsStorage } from '@shellui/sdk';

export type WebhookServiceKey = 'identity' | 'hosting' | 'storage';

export const WEBHOOK_SERVICE_KEYS: WebhookServiceKey[] = ['identity', 'hosting', 'storage'];

export const DEFAULT_WEBHOOK_SERVICE: WebhookServiceKey = 'identity';

export function isWebhookServiceKey(value: string): value is WebhookServiceKey {
  return value === 'identity' || value === 'hosting' || value === 'storage';
}

export type WebhookServiceDefinition = {
  key: WebhookServiceKey;
  labelKey: 'webhooksServiceIdentity' | 'webhooksServiceHosting' | 'webhooksServiceStorage';
  badgeKey: 'webhooksBadgeIdentity' | 'webhooksBadgeHosting' | 'webhooksBadgeStorage';
  pageTitleKey:
    | 'webhooksPageTitleIdentity'
    | 'webhooksPageTitleHosting'
    | 'webhooksPageTitleStorage';
  deliveriesPageTitleKey:
    | 'webhooksDeliveriesPageTitleIdentity'
    | 'webhooksDeliveriesPageTitleHosting'
    | 'webhooksDeliveriesPageTitleStorage';
  descriptionKey:
    | 'webhooksPageDescriptionIdentity'
    | 'webhooksPageDescriptionHosting'
    | 'webhooksPageDescriptionStorage';
  eventScopeKey:
    | 'webhooksEventScopeIdentity'
    | 'webhooksEventScopeHosting'
    | 'webhooksEventScopeStorage';
  baseUrl: string | null;
};

function normalizeServiceUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().replace(/\/+$/, '');
}

export function resolveWebhookServiceBaseUrl(
  key: WebhookServiceKey,
  options: {
    identityBaseUrl?: string | null;
    hosting?: SettingsHosting | null;
    storage?: SettingsStorage | null;
  },
): string | null {
  switch (key) {
    case 'identity':
      return normalizeServiceUrl(options.identityBaseUrl);
    case 'hosting':
      if (!isHostingAdminEnabled(options.hosting ?? null)) return null;
      return normalizeServiceUrl(options.hosting?.url);
    case 'storage':
      return normalizeServiceUrl(options.storage?.url);
    default:
      return null;
  }
}

export function listConfiguredWebhookServices(options: {
  identityBaseUrl?: string | null;
  hosting?: SettingsHosting | null;
  storage?: SettingsStorage | null;
}): WebhookServiceDefinition[] {
  const defs: WebhookServiceDefinition[] = [
    {
      key: 'identity',
      labelKey: 'webhooksServiceIdentity',
      badgeKey: 'webhooksBadgeIdentity',
      pageTitleKey: 'webhooksPageTitleIdentity',
      deliveriesPageTitleKey: 'webhooksDeliveriesPageTitleIdentity',
      descriptionKey: 'webhooksPageDescriptionIdentity',
      eventScopeKey: 'webhooksEventScopeIdentity',
      baseUrl: resolveWebhookServiceBaseUrl('identity', options),
    },
    {
      key: 'hosting',
      labelKey: 'webhooksServiceHosting',
      badgeKey: 'webhooksBadgeHosting',
      pageTitleKey: 'webhooksPageTitleHosting',
      deliveriesPageTitleKey: 'webhooksDeliveriesPageTitleHosting',
      descriptionKey: 'webhooksPageDescriptionHosting',
      eventScopeKey: 'webhooksEventScopeHosting',
      baseUrl: resolveWebhookServiceBaseUrl('hosting', options),
    },
    {
      key: 'storage',
      labelKey: 'webhooksServiceStorage',
      badgeKey: 'webhooksBadgeStorage',
      pageTitleKey: 'webhooksPageTitleStorage',
      deliveriesPageTitleKey: 'webhooksDeliveriesPageTitleStorage',
      descriptionKey: 'webhooksPageDescriptionStorage',
      eventScopeKey: 'webhooksEventScopeStorage',
      baseUrl: resolveWebhookServiceBaseUrl('storage', options),
    },
  ];
  return defs.filter((d) => Boolean(d.baseUrl));
}

export function actionsApiUnavailableMessage(service: WebhookServiceKey): string {
  switch (service) {
    case 'identity':
      return 'Webhooks API is not available on this identity version. Update identity-service or run a build that includes company webhook endpoints.';
    case 'hosting':
      return 'Webhooks API is not available on this hosting version. Update hosting-service to v0.5.0 or newer.';
    case 'storage':
      return 'Webhooks API is not available on this storage version. Update storage-service to v0.4.0 or newer.';
    default:
      return 'Webhooks API is not available on this service version.';
  }
}
