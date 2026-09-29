import { describe, expect, it } from 'vitest';
import {
  LEGACY_ACTIONS_DELIVERIES_PATH,
  LEGACY_ACTIONS_RULES_PATH,
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
});
