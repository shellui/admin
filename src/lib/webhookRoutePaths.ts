import {
  DEFAULT_WEBHOOK_SERVICE,
  isWebhookServiceKey,
  type WebhookServiceKey,
} from '@/lib/webhookServices';

/** Normalized rules list suffix used for sub-nav matching (after `/{service}` prefix). */
export const WEBHOOKS_RULES_SUFFIX = '/webhooks';
export const WEBHOOKS_RULES_NEW_SUFFIX = '/webhooks/new';
export const WEBHOOKS_DELIVERIES_SUFFIX = '/webhooks/deliveries';

/** Legacy `#/webhooks` (redirects to identity). */
export const LEGACY_WEBHOOKS_RULES_PATH = '/webhooks';
export const LEGACY_WEBHOOKS_RULES_NEW_PATH = '/webhooks/new';
export const LEGACY_WEBHOOKS_DELIVERIES_PATH = '/webhooks/deliveries';

/** Legacy `#/actions/...` paths (redirect to identity webhooks). */
export const LEGACY_ACTIONS_RULES_PATH = '/actions/rules';
export const LEGACY_ACTIONS_DELIVERIES_PATH = '/actions/deliveries';

const WEBHOOKS_TAIL_RESERVED = new Set(['new', 'deliveries', 'email']);

function serviceWebhooksRoot(service: WebhookServiceKey): string {
  return `/${service}/webhooks`;
}

export function webhookRulesListPath(service: WebhookServiceKey = DEFAULT_WEBHOOK_SERVICE): string {
  return serviceWebhooksRoot(service);
}

export function webhookRulesNewPath(service: WebhookServiceKey = DEFAULT_WEBHOOK_SERVICE): string {
  return `${serviceWebhooksRoot(service)}/new`;
}

export function webhookRuleEditPath(service: WebhookServiceKey, ruleId: string | number): string {
  return `${serviceWebhooksRoot(service)}/${encodeURIComponent(String(ruleId))}`;
}

export function emailRuleNewPath(service: WebhookServiceKey): string {
  return `${serviceWebhooksRoot(service)}/email/new`;
}

export function emailRuleEditPath(service: WebhookServiceKey, ruleId: string | number): string {
  return `${serviceWebhooksRoot(service)}/email/${encodeURIComponent(String(ruleId))}`;
}

export function emailTemplateEditorPath(templateId: number): string {
  return `/email/templates/id/${templateId}`;
}

export function webhookDeliveriesPath(
  service: WebhookServiceKey = DEFAULT_WEBHOOK_SERVICE,
): string {
  return `${serviceWebhooksRoot(service)}/deliveries`;
}

export function webhookDeliveryDetailPath(service: WebhookServiceKey, deliveryId: string): string {
  return `${webhookDeliveriesPath(service)}/${encodeURIComponent(deliveryId)}`;
}

/**
 * Infer webhook service from a hash-router pathname (no hash prefix).
 * Expects `/{service}/webhooks/...`.
 */
export function resolveWebhookServiceFromPathname(pathname: string): WebhookServiceKey {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2 && segments[1] === 'webhooks' && isWebhookServiceKey(segments[0])) {
    return segments[0];
  }
  return DEFAULT_WEBHOOK_SERVICE;
}

/** Map legacy `#/webhooks/...` paths to the new per-service routes. */
export function legacyWebhooksRedirectTarget(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'webhooks') {
    return webhookRulesListPath(DEFAULT_WEBHOOK_SERVICE);
  }
  const rest = segments.slice(1);
  if (rest.length === 0) {
    return webhookRulesListPath(DEFAULT_WEBHOOK_SERVICE);
  }
  if (rest[0] === 'hosting') {
    const tail = rest.slice(1);
    const base = webhookRulesListPath('hosting');
    return tail.length ? `${base}/${tail.map(encodeURIComponent).join('/')}` : base;
  }
  if (rest[0] === 'storage') {
    const tail = rest.slice(1);
    const base = webhookRulesListPath('storage');
    return tail.length ? `${base}/${tail.map(encodeURIComponent).join('/')}` : base;
  }
  if (rest[0] === 'identity') {
    const tail = rest.slice(1);
    const base = webhookRulesListPath('identity');
    return tail.length ? `${base}/${tail.map(encodeURIComponent).join('/')}` : base;
  }
  const base = webhookRulesListPath(DEFAULT_WEBHOOK_SERVICE);
  return `${base}/${rest.map(encodeURIComponent).join('/')}`;
}

/** Strip the service prefix for sub-nav active-state matching. */
export function webhooksPathWithoutService(pathname: string): string {
  const service = resolveWebhookServiceFromPathname(pathname);
  const prefix = serviceWebhooksRoot(service);
  if (pathname === prefix) return WEBHOOKS_RULES_SUFFIX;
  if (pathname.startsWith(`${prefix}/`)) {
    return WEBHOOKS_RULES_SUFFIX + pathname.slice(prefix.length);
  }
  return pathname;
}

export function isWebhooksRulesSectionPath(pathname: string): boolean {
  const normalized = webhooksPathWithoutService(pathname);
  if (normalized === WEBHOOKS_RULES_SUFFIX || normalized === WEBHOOKS_RULES_NEW_SUFFIX) return true;
  if (!normalized.startsWith(`${WEBHOOKS_RULES_SUFFIX}/`)) return false;
  return !normalized.startsWith(WEBHOOKS_DELIVERIES_SUFFIX);
}

export function isWebhooksDeliveriesSectionPath(pathname: string): boolean {
  const normalized = webhooksPathWithoutService(pathname);
  return (
    normalized === WEBHOOKS_DELIVERIES_SUFFIX ||
    normalized.startsWith(`${WEBHOOKS_DELIVERIES_SUFFIX}/`)
  );
}

/** Parse rule id segment for editor routes; returns null on create routes. */
export function parseWebhookRuleIdFromPathname(pathname: string): string | null {
  const service = resolveWebhookServiceFromPathname(pathname);
  const prefix = serviceWebhooksRoot(service);
  if (!pathname.startsWith(`${prefix}/`)) return null;
  const tail = pathname
    .slice(prefix.length + 1)
    .split('/')
    .filter(Boolean);
  if (tail.length !== 1) return null;
  const id = tail[0];
  if (id === 'new' || WEBHOOKS_TAIL_RESERVED.has(id)) return null;
  return id;
}

export function isWebhookCreatePath(pathname: string): boolean {
  const service = resolveWebhookServiceFromPathname(pathname);
  return pathname === webhookRulesNewPath(service);
}
