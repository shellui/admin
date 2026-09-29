import { describe, expect, it } from 'vitest';
import {
  isWebhookCreatePath,
  isWebhooksDeliveriesSectionPath,
  isWebhooksRulesSectionPath,
  LEGACY_ACTIONS_DELIVERIES_PATH,
  LEGACY_ACTIONS_RULES_PATH,
  parseWebhookRuleIdFromPathname,
  resolveWebhookServiceFromPathname,
  webhookDeliveriesPath,
  webhookRuleEditPath,
  webhookRulesListPath,
  webhookRulesNewPath,
  WEBHOOKS_DELIVERIES_PATH,
  WEBHOOKS_RULES_NEW_PATH,
  WEBHOOKS_RULES_PATH,
} from '@/lib/webhookRoutePaths';

describe('webhookRoutePaths', () => {
  it('uses webhooks hash paths instead of legacy actions paths', () => {
    expect(WEBHOOKS_RULES_PATH).toBe('/webhooks');
    expect(WEBHOOKS_RULES_NEW_PATH).toBe('/webhooks/new');
    expect(WEBHOOKS_DELIVERIES_PATH).toBe('/webhooks/deliveries');
    expect(LEGACY_ACTIONS_RULES_PATH).toBe('/actions/rules');
    expect(LEGACY_ACTIONS_DELIVERIES_PATH).toBe('/actions/deliveries');
  });

  it('defaults identity for legacy paths and numeric rule ids', () => {
    expect(resolveWebhookServiceFromPathname('/webhooks')).toBe('identity');
    expect(resolveWebhookServiceFromPathname('/webhooks/new')).toBe('identity');
    expect(resolveWebhookServiceFromPathname('/webhooks/42')).toBe('identity');
    expect(resolveWebhookServiceFromPathname('/webhooks/deliveries')).toBe('identity');
  });

  it('resolves hosting and storage service segments', () => {
    expect(resolveWebhookServiceFromPathname('/webhooks/hosting')).toBe('hosting');
    expect(resolveWebhookServiceFromPathname('/webhooks/hosting/new')).toBe('hosting');
    expect(resolveWebhookServiceFromPathname('/webhooks/hosting/7')).toBe('hosting');
    expect(resolveWebhookServiceFromPathname('/webhooks/storage/deliveries')).toBe('storage');
  });

  it('builds per-service paths with identity as default prefix', () => {
    expect(webhookRulesListPath('identity')).toBe('/webhooks');
    expect(webhookRulesNewPath('identity')).toBe('/webhooks/new');
    expect(webhookDeliveriesPath('identity')).toBe('/webhooks/deliveries');
    expect(webhookRuleEditPath('identity', 3)).toBe('/webhooks/3');

    expect(webhookRulesListPath('hosting')).toBe('/webhooks/hosting');
    expect(webhookRulesNewPath('hosting')).toBe('/webhooks/hosting/new');
    expect(webhookDeliveriesPath('hosting')).toBe('/webhooks/hosting/deliveries');
    expect(webhookRuleEditPath('hosting', 9)).toBe('/webhooks/hosting/9');

    expect(webhookRulesListPath('storage')).toBe('/webhooks/storage');
    expect(webhookRuleEditPath('storage', 1)).toBe('/webhooks/storage/1');
  });

  it('parses create and edit rule paths per service', () => {
    expect(isWebhookCreatePath('/webhooks/new')).toBe(true);
    expect(isWebhookCreatePath('/webhooks/hosting/new')).toBe(true);
    expect(parseWebhookRuleIdFromPathname('/webhooks/12')).toBe('12');
    expect(parseWebhookRuleIdFromPathname('/webhooks/hosting/12')).toBe('12');
    expect(parseWebhookRuleIdFromPathname('/webhooks/new')).toBe(null);
  });

  it('matches rules vs deliveries sections per service', () => {
    expect(isWebhooksRulesSectionPath('/webhooks/hosting')).toBe(true);
    expect(isWebhooksRulesSectionPath('/webhooks/hosting/new')).toBe(true);
    expect(isWebhooksDeliveriesSectionPath('/webhooks/hosting/deliveries')).toBe(true);
    expect(isWebhooksRulesSectionPath('/webhooks/hosting/deliveries')).toBe(false);
  });
});
