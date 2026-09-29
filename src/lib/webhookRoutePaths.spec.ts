import { describe, expect, it } from 'vitest';
import {
  isWebhookCreatePath,
  isWebhooksDeliveriesSectionPath,
  isWebhooksRulesSectionPath,
  LEGACY_ACTIONS_DELIVERIES_PATH,
  LEGACY_ACTIONS_RULES_PATH,
  LEGACY_WEBHOOKS_DELIVERIES_PATH,
  LEGACY_WEBHOOKS_RULES_NEW_PATH,
  LEGACY_WEBHOOKS_RULES_PATH,
  legacyWebhooksRedirectTarget,
  parseWebhookRuleIdFromPathname,
  resolveWebhookServiceFromPathname,
  webhookDeliveriesPath,
  webhookRuleEditPath,
  webhookRulesListPath,
  webhookRulesNewPath,
  WEBHOOKS_DELIVERIES_SUFFIX,
  WEBHOOKS_RULES_NEW_SUFFIX,
  WEBHOOKS_RULES_SUFFIX,
} from '@/lib/webhookRoutePaths';

describe('webhookRoutePaths', () => {
  it('uses per-service webhooks paths under identity, hosting, and storage', () => {
    expect(webhookRulesListPath('identity')).toBe('/identity/webhooks');
    expect(webhookRulesNewPath('identity')).toBe('/identity/webhooks/new');
    expect(webhookDeliveriesPath('identity')).toBe('/identity/webhooks/deliveries');
    expect(webhookRuleEditPath('identity', 3)).toBe('/identity/webhooks/3');

    expect(webhookRulesListPath('hosting')).toBe('/hosting/webhooks');
    expect(webhookRulesNewPath('hosting')).toBe('/hosting/webhooks/new');
    expect(webhookDeliveriesPath('hosting')).toBe('/hosting/webhooks/deliveries');
    expect(webhookRuleEditPath('hosting', 9)).toBe('/hosting/webhooks/9');

    expect(webhookRulesListPath('storage')).toBe('/storage/webhooks');
    expect(webhookRuleEditPath('storage', 1)).toBe('/storage/webhooks/1');
  });

  it('keeps legacy path constants for redirects', () => {
    expect(LEGACY_WEBHOOKS_RULES_PATH).toBe('/webhooks');
    expect(LEGACY_WEBHOOKS_RULES_NEW_PATH).toBe('/webhooks/new');
    expect(LEGACY_WEBHOOKS_DELIVERIES_PATH).toBe('/webhooks/deliveries');
    expect(LEGACY_ACTIONS_RULES_PATH).toBe('/actions/rules');
    expect(LEGACY_ACTIONS_DELIVERIES_PATH).toBe('/actions/deliveries');
    expect(WEBHOOKS_RULES_SUFFIX).toBe('/webhooks');
    expect(WEBHOOKS_RULES_NEW_SUFFIX).toBe('/webhooks/new');
    expect(WEBHOOKS_DELIVERIES_SUFFIX).toBe('/webhooks/deliveries');
  });

  it('resolves service from pathname prefix', () => {
    expect(resolveWebhookServiceFromPathname('/identity/webhooks')).toBe('identity');
    expect(resolveWebhookServiceFromPathname('/identity/webhooks/42')).toBe('identity');
    expect(resolveWebhookServiceFromPathname('/hosting/webhooks/deliveries')).toBe('hosting');
    expect(resolveWebhookServiceFromPathname('/storage/webhooks/new')).toBe('storage');
    expect(resolveWebhookServiceFromPathname('/company')).toBe('identity');
  });

  it('redirects legacy #/webhooks paths to identity or prior PR service tabs', () => {
    expect(legacyWebhooksRedirectTarget('/webhooks')).toBe('/identity/webhooks');
    expect(legacyWebhooksRedirectTarget('/webhooks/new')).toBe('/identity/webhooks/new');
    expect(legacyWebhooksRedirectTarget('/webhooks/12')).toBe('/identity/webhooks/12');
    expect(legacyWebhooksRedirectTarget('/webhooks/hosting')).toBe('/hosting/webhooks');
    expect(legacyWebhooksRedirectTarget('/webhooks/hosting/new')).toBe('/hosting/webhooks/new');
    expect(legacyWebhooksRedirectTarget('/webhooks/storage/deliveries')).toBe(
      '/storage/webhooks/deliveries',
    );
  });

  it('parses create and edit rule paths per service', () => {
    expect(isWebhookCreatePath('/identity/webhooks/new')).toBe(true);
    expect(isWebhookCreatePath('/hosting/webhooks/new')).toBe(true);
    expect(parseWebhookRuleIdFromPathname('/identity/webhooks/12')).toBe('12');
    expect(parseWebhookRuleIdFromPathname('/hosting/webhooks/12')).toBe('12');
    expect(parseWebhookRuleIdFromPathname('/identity/webhooks/new')).toBe(null);
  });

  it('matches rules vs deliveries sections per service', () => {
    expect(isWebhooksRulesSectionPath('/hosting/webhooks')).toBe(true);
    expect(isWebhooksRulesSectionPath('/hosting/webhooks/new')).toBe(true);
    expect(isWebhooksDeliveriesSectionPath('/hosting/webhooks/deliveries')).toBe(true);
    expect(isWebhooksRulesSectionPath('/hosting/webhooks/deliveries')).toBe(false);
  });
});
