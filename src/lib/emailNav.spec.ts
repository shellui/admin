import { describe, expect, it } from 'vitest';
import { adminShellUiConfig } from '@/admin.shellui.config';
import i18n from '@/i18n';
import { legacyWebhooksRedirectTarget, webhookRulesListPath } from '@/lib/webhookRoutePaths';

describe('email and webhooks route rename', () => {
  it('renames the identity sidebar entry and keeps #/identity/webhooks', () => {
    const identity = adminShellUiConfig.navigation.find(
      (entry) =>
        'title' in entry &&
        entry.title &&
        typeof entry.title !== 'string' &&
        entry.title.en === 'Identity',
    );
    expect(identity && 'items' in identity).toBe(true);
    if (!identity || !('items' in identity)) return;
    const item = identity.items.find((entry) => entry.path === 'identity/webhooks');
    expect(item?.label).toEqual({ en: 'Email and webhooks', fr: 'E-mail et webhooks' });
    expect(item?.url).toBe('#/identity/webhooks');
  });

  it('keeps hosting, storage, and legacy identity routes', () => {
    expect(webhookRulesListPath('hosting')).toBe('/hosting/webhooks');
    expect(webhookRulesListPath('storage')).toBe('/storage/webhooks');
    expect(webhookRulesListPath('identity')).toBe('/identity/webhooks');
    expect(legacyWebhooksRedirectTarget('/webhooks')).toBe('/identity/webhooks');
    expect(legacyWebhooksRedirectTarget('/webhooks/deliveries')).toBe(
      '/identity/webhooks/deliveries',
    );
  });

  it('keeps the standalone Email group items and leaves Email and webhooks under Identity', () => {
    const groups = adminShellUiConfig.navigation.filter(
      (entry) => 'title' in entry && 'items' in entry,
    );
    const identity = groups.find(
      (entry) =>
        'title' in entry && typeof entry.title !== 'string' && entry.title.en === 'Identity',
    );
    const email = groups.find(
      (entry) => 'title' in entry && typeof entry.title !== 'string' && entry.title.en === 'Email',
    );
    expect(
      identity && 'items' in identity ? identity.items.map((item) => item.path) : [],
    ).toContain('identity/webhooks');
    expect(email && 'items' in email ? email.items.map((item) => item.path) : []).toEqual([
      'email/templates',
      'email/broadcasts',
      'email/provider',
      'email/statistics',
    ]);
  });

  it('translates the shared sidebar label in English and French', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('navEmailAndWebhooks')).toBe('Email and webhooks');
    await i18n.changeLanguage('fr');
    expect(i18n.t('navEmailAndWebhooks')).toBe('E-mail et webhooks');
    await i18n.changeLanguage('en');
  });
});
