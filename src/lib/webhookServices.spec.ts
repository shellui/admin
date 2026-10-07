import { describe, expect, it } from 'vitest';
import {
  actionsApiUnavailableMessage,
  listConfiguredWebhookServices,
  resolveWebhookServiceBaseUrl,
} from '@/lib/webhookServices';

describe('webhookServices', () => {
  it('resolves base URLs from shell settings', () => {
    expect(
      resolveWebhookServiceBaseUrl('identity', { identityBaseUrl: 'https://id.example.com/' }),
    ).toBe('https://id.example.com');
    expect(
      resolveWebhookServiceBaseUrl('hosting', {
        hosting: { url: 'https://host.example.com', showInAdmin: true },
      }),
    ).toBe('https://host.example.com');
    expect(
      resolveWebhookServiceBaseUrl('hosting', {
        hosting: { url: 'https://host.example.com', showInAdmin: false },
      }),
    ).toBe(null);
    expect(
      resolveWebhookServiceBaseUrl('storage', {
        storage: { url: 'https://storage.example.com', filesUrl: 'https://files.example.com' },
      }),
    ).toBe('https://storage.example.com');
  });

  it('lists only configured services for the picker', () => {
    const all = listConfiguredWebhookServices({
      identityBaseUrl: 'https://id.example.com',
      hosting: { url: 'https://host.example.com' },
      storage: null,
    });
    expect(all.map((s) => s.key)).toEqual(['identity', 'hosting']);
  });

  it('returns service-specific unavailable messages', () => {
    expect(actionsApiUnavailableMessage('identity')).toContain('identity');
    expect(actionsApiUnavailableMessage('hosting')).toContain('hosting');
    expect(actionsApiUnavailableMessage('storage')).toContain('storage');
  });
});
