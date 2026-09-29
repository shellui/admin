import { describe, expect, it } from 'vitest';
import {
  buildAdminHashContentUrl,
  findMatchingNavItem,
  getNavSubPath,
} from '@/lib/contentNavUtils';
import {
  legacyWebhooksRedirectTarget,
  webhookDeliveriesPath,
  webhookRuleEditPath,
  webhookRulesListPath,
  webhookRulesNewPath,
} from '@/lib/webhookRoutePaths';

const ORIGIN = 'http://localhost:4000/admin';

/** Mirrors storage/hosting webhook entries registered in useAdminContentNavigation. */
function storageHostingEmbedItems() {
  return [
    { path: 'storage', url: 'https://files.example/' },
    {
      path: 'storage/webhooks',
      url: buildAdminHashContentUrl(ORIGIN, 'storage/webhooks', '', ''),
    },
    {
      path: 'storage/statistics',
      url: buildAdminHashContentUrl(ORIGIN, 'storage/statistics', '', ''),
    },
    { path: 'hosting', url: buildAdminHashContentUrl(ORIGIN, 'hosting', '', '') },
    {
      path: 'hosting/webhooks',
      url: buildAdminHashContentUrl(ORIGIN, 'hosting/webhooks', '', ''),
    },
    {
      path: 'identity/webhooks',
      url: buildAdminHashContentUrl(ORIGIN, 'identity/webhooks', '', ''),
    },
  ];
}

describe('webhook shell path routing', () => {
  it('prefers storage/webhooks over the storage files embed (regression)', () => {
    const items = storageHostingEmbedItems();
    expect(findMatchingNavItem('/storage/webhooks', items)?.path).toBe('storage/webhooks');
    expect(findMatchingNavItem('/storage/webhooks/new', items)?.path).toBe('storage/webhooks');
    expect(findMatchingNavItem('/storage/webhooks/deliveries', items)?.path).toBe(
      'storage/webhooks',
    );
    expect(findMatchingNavItem('/storage/webhooks/7', items)?.path).toBe('storage/webhooks');
    expect(findMatchingNavItem('/storage/webhooks', items)?.path).not.toBe('storage');
  });

  it('prefers hosting/webhooks over the hosting apps embed', () => {
    const items = storageHostingEmbedItems();
    expect(findMatchingNavItem('/hosting/webhooks', items)?.path).toBe('hosting/webhooks');
    expect(findMatchingNavItem('/hosting/webhooks/new', items)?.path).toBe('hosting/webhooks');
  });

  it('maps subpaths to hash routes for webhook CRUD and deliveries', () => {
    const item = { path: 'storage/webhooks' };
    expect(getNavSubPath('/storage/webhooks/new', item)).toBe('new');
    expect(getNavSubPath('/storage/webhooks/42', item)).toBe('42');
    expect(getNavSubPath('/storage/webhooks/deliveries/uuid', item)).toBe('deliveries/uuid');

    const built = buildAdminHashContentUrl(ORIGIN, 'storage/webhooks', 'new', '');
    expect(built).toBe(`${ORIGIN}/#/storage/webhooks/new`);
  });

  it('documents canonical webhook hash paths and legacy redirects', () => {
    expect(webhookRulesListPath('identity')).toBe('/identity/webhooks');
    expect(webhookRulesNewPath('hosting')).toBe('/hosting/webhooks/new');
    expect(webhookRuleEditPath('storage', 3)).toBe('/storage/webhooks/3');
    expect(webhookDeliveriesPath('storage')).toBe('/storage/webhooks/deliveries');

    expect(legacyWebhooksRedirectTarget('/webhooks')).toBe('/identity/webhooks');
    expect(legacyWebhooksRedirectTarget('/webhooks/new')).toBe('/identity/webhooks/new');
  });
});
