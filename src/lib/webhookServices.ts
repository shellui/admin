import { isHostingAdminEnabled, type SettingsHosting } from '@/hooks/useShelluiHosting';
import type { SettingsStorage } from '@shellui/sdk';
import {
  isEmailAdminEnabled,
  resolveEmailServiceUrl,
  type SettingsEmail,
} from '@/lib/emailServiceUrl';

export type WebhookServiceKey = 'identity' | 'hosting' | 'storage' | 'email';

export const WEBHOOK_SERVICE_KEYS: WebhookServiceKey[] = [
  'identity',
  'hosting',
  'storage',
  'email',
];

export const DEFAULT_WEBHOOK_SERVICE: WebhookServiceKey = 'identity';

export function isWebhookServiceKey(value: string): value is WebhookServiceKey {
  return value === 'identity' || value === 'hosting' || value === 'storage' || value === 'email';
}

export type WebhookServiceDefinition = {
  key: WebhookServiceKey;
  labelKey:
    | 'webhooksServiceIdentity'
    | 'webhooksServiceHosting'
    | 'webhooksServiceStorage'
    | 'webhooksServiceEmail';
  badgeKey:
    | 'webhooksBadgeIdentity'
    | 'webhooksBadgeHosting'
    | 'webhooksBadgeStorage'
    | 'webhooksBadgeEmail';
  pageTitleKey:
    | 'webhooksPageTitleIdentity'
    | 'webhooksPageTitleHosting'
    | 'webhooksPageTitleStorage'
    | 'webhooksPageTitleEmail';
  deliveriesPageTitleKey:
    | 'webhooksDeliveriesPageTitleIdentity'
    | 'webhooksDeliveriesPageTitleHosting'
    | 'webhooksDeliveriesPageTitleStorage'
    | 'webhooksDeliveriesPageTitleEmail';
  descriptionKey:
    | 'webhooksPageDescriptionIdentity'
    | 'webhooksPageDescriptionHosting'
    | 'webhooksPageDescriptionStorage'
    | 'webhooksPageDescriptionEmail';
  eventScopeKey:
    | 'webhooksEventScopeIdentity'
    | 'webhooksEventScopeHosting'
    | 'webhooksEventScopeStorage'
    | 'webhooksEventScopeEmail';
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
    email?: SettingsEmail | null;
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
    case 'email':
      if (!isEmailAdminEnabled(options.email ?? null)) return null;
      return resolveEmailServiceUrl(options.email?.url);
    default:
      return null;
  }
}

export function listConfiguredWebhookServices(options: {
  identityBaseUrl?: string | null;
  hosting?: SettingsHosting | null;
  storage?: SettingsStorage | null;
  email?: SettingsEmail | null;
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
    {
      key: 'email',
      labelKey: 'webhooksServiceEmail',
      badgeKey: 'webhooksBadgeEmail',
      pageTitleKey: 'webhooksPageTitleEmail',
      deliveriesPageTitleKey: 'webhooksDeliveriesPageTitleEmail',
      descriptionKey: 'webhooksPageDescriptionEmail',
      eventScopeKey: 'webhooksEventScopeEmail',
      baseUrl: resolveWebhookServiceBaseUrl('email', options),
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
    case 'email':
      return 'Webhooks API is not available on this email version. Update email-service to v0.5.0 or newer.';
    default:
      return 'Webhooks API is not available on this service version.';
  }
}
