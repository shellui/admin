import {
  DEFAULT_WEBHOOK_SERVICE,
  isWebhookServiceKey,
  WEBHOOKS_RESERVED_SEGMENTS,
  type WebhookServiceKey,
} from '@/lib/webhookServices';

/** Primary hash-router paths for the Webhooks admin UI (identity default). */
export const WEBHOOKS_RULES_PATH = '/webhooks';
export const WEBHOOKS_RULES_NEW_PATH = '/webhooks/new';
export const WEBHOOKS_DELIVERIES_PATH = '/webhooks/deliveries';

/** Legacy `#/actions/...` paths (redirect to webhooks). */
export const LEGACY_ACTIONS_RULES_PATH = '/actions/rules';
export const LEGACY_ACTIONS_DELIVERIES_PATH = '/actions/deliveries';

function serviceRoot(service: WebhookServiceKey): string {
  if (service === DEFAULT_WEBHOOK_SERVICE) return WEBHOOKS_RULES_PATH;
  return `${WEBHOOKS_RULES_PATH}/${service}`;
}

export function webhookRulesListPath(service: WebhookServiceKey = DEFAULT_WEBHOOK_SERVICE): string {
  return serviceRoot(service);
}

export function webhookRulesNewPath(service: WebhookServiceKey = DEFAULT_WEBHOOK_SERVICE): string {
  return `${serviceRoot(service)}/new`;
}

export function webhookRuleEditPath(service: WebhookServiceKey, ruleId: string | number): string {
  return `${serviceRoot(service)}/${encodeURIComponent(String(ruleId))}`;
}

export function webhookDeliveriesPath(
  service: WebhookServiceKey = DEFAULT_WEBHOOK_SERVICE,
): string {
  return `${serviceRoot(service)}/deliveries`;
}

export function webhookDeliveryDetailPath(service: WebhookServiceKey, deliveryId: string): string {
  return `${webhookDeliveriesPath(service)}/${encodeURIComponent(deliveryId)}`;
}

/**
 * Infer webhook service from a hash-router pathname (no hash prefix).
 * Identity keeps legacy paths such as `/webhooks/new` and `/webhooks/12`.
 */
export function resolveWebhookServiceFromPathname(pathname: string): WebhookServiceKey {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'webhooks') return DEFAULT_WEBHOOK_SERVICE;
  const second = segments[1];
  if (second && isWebhookServiceKey(second)) return second;
  return DEFAULT_WEBHOOK_SERVICE;
}

/** Strip the service prefix from a webhooks pathname for sub-nav matching. */
export function webhooksPathWithoutService(pathname: string): string {
  const service = resolveWebhookServiceFromPathname(pathname);
  if (service === DEFAULT_WEBHOOK_SERVICE) return pathname;
  const prefix = `${WEBHOOKS_RULES_PATH}/${service}`;
  if (pathname === prefix) return WEBHOOKS_RULES_PATH;
  if (pathname.startsWith(`${prefix}/`)) {
    return WEBHOOKS_RULES_PATH + pathname.slice(prefix.length);
  }
  return pathname;
}

export function isWebhooksRulesSectionPath(pathname: string): boolean {
  const normalized = webhooksPathWithoutService(pathname);
  if (normalized === WEBHOOKS_RULES_PATH || normalized === WEBHOOKS_RULES_NEW_PATH) return true;
  if (!normalized.startsWith(`${WEBHOOKS_RULES_PATH}/`)) return false;
  return !normalized.startsWith(WEBHOOKS_DELIVERIES_PATH);
}

export function isWebhooksDeliveriesSectionPath(pathname: string): boolean {
  const normalized = webhooksPathWithoutService(pathname);
  return (
    normalized === WEBHOOKS_DELIVERIES_PATH || normalized.startsWith(`${WEBHOOKS_DELIVERIES_PATH}/`)
  );
}

/** Parse rule id segment for editor routes; returns null on create routes. */
export function parseWebhookRuleIdFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'webhooks') return null;
  const service = resolveWebhookServiceFromPathname(pathname);
  const tail = service === DEFAULT_WEBHOOK_SERVICE ? segments.slice(1) : segments.slice(2);
  if (tail.length !== 1) return null;
  const id = tail[0];
  if (id === 'new' || WEBHOOKS_RESERVED_SEGMENTS.has(id)) return null;
  return id;
}

export function isWebhookCreatePath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'webhooks') return false;
  const service = resolveWebhookServiceFromPathname(pathname);
  const tail = service === DEFAULT_WEBHOOK_SERVICE ? segments.slice(1) : segments.slice(2);
  return tail.length === 1 && tail[0] === 'new';
}
