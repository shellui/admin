import { describe, expect, it } from 'vitest';
import {
  contentFrameAuthRulesFromEmbeds,
  frameSettingsDelivery,
  frameSrcMatchesAppUrl,
  matchContentFrameRule,
  settingsPayloadForDelivery,
  type ContentFrameAuthRule,
} from '@/lib/contentFrameAuth';

const PAGE = 'https://admin.example/admin/';

describe('frameSrcMatchesAppUrl', () => {
  it('matches a site-root app and a deep link on that origin', () => {
    expect(
      frameSrcMatchesAppUrl('https://files.example/company/docs', 'https://files.example/', PAGE),
    ).toBe(true);
    expect(
      frameSrcMatchesAppUrl('https://files.example/app/docs', 'https://files.example/app', PAGE),
    ).toBe(true);
    expect(
      frameSrcMatchesAppUrl('https://files.example/other', 'https://files.example/app', PAGE),
    ).toBe(false);
    expect(frameSrcMatchesAppUrl('https://evil.example/', 'https://files.example/', PAGE)).toBe(
      false,
    );
  });

  it('matches a hash-router prefix and rejects a different hash', () => {
    expect(
      frameSrcMatchesAppUrl(
        'https://play.example/#/home/edit',
        'https://play.example/#/home',
        PAGE,
      ),
    ).toBe(true);
    expect(
      frameSrcMatchesAppUrl('https://play.example/#/other', 'https://play.example/#/home', PAGE),
    ).toBe(false);
  });
});

describe('frameSettingsDelivery', () => {
  const rules: ContentFrameAuthRule[] = [
    { url: 'https://files.example/', safeForAuthToken: true },
    { url: 'https://id.example/api/docs/', safeForAuthToken: true, ignoreMessages: true },
    { url: 'https://id.example/api/docs/redoc/', ignoreMessages: true },
    { url: 'https://billing.example/', safeForAuthToken: true },
    { url: 'https://other.example/' },
  ];

  it('includes the token for a same-origin admin frame', () => {
    expect(frameSettingsDelivery('https://admin.example/#/users', rules, PAGE)).toEqual({
      forward: true,
      includeAccessToken: true,
    });
  });

  it('includes the token only for URLs marked safeForAuthToken', () => {
    expect(frameSettingsDelivery('https://files.example/bucket', rules, PAGE)).toEqual({
      forward: true,
      includeAccessToken: true,
    });
    expect(frameSettingsDelivery('https://billing.example/#/', rules, PAGE)).toEqual({
      forward: true,
      includeAccessToken: true,
    });
    expect(frameSettingsDelivery('https://other.example/#/', rules, PAGE)).toEqual({
      forward: true,
      includeAccessToken: false,
    });
    expect(frameSettingsDelivery('https://unknown.example/', rules, PAGE)).toEqual({
      forward: true,
      includeAccessToken: false,
    });
  });

  it('keeps the token for Swagger and drops fan-out to ReDoc', () => {
    expect(frameSettingsDelivery('https://id.example/api/docs/', rules, PAGE)).toEqual({
      forward: true,
      includeAccessToken: true,
    });
    expect(frameSettingsDelivery('https://id.example/api/docs/redoc/', rules, PAGE)).toEqual({
      forward: false,
      includeAccessToken: false,
    });
  });

  it('prefers a longer app URL over a site root on the same origin', () => {
    const nested: ContentFrameAuthRule[] = [
      { url: 'https://files.example/', safeForAuthToken: true },
      { url: 'https://files.example/custom', safeForAuthToken: false },
    ];
    expect(matchContentFrameRule('https://files.example/custom/page', nested, PAGE)?.url).toBe(
      'https://files.example/custom',
    );
    expect(frameSettingsDelivery('https://files.example/custom/page', nested, PAGE)).toEqual({
      forward: true,
      includeAccessToken: false,
    });
  });
});

describe('settingsPayloadForDelivery', () => {
  const payload = {
    settings: { accessToken: 'secret', user: { id: '1' }, appearance: { mode: 'dark' } },
  };

  it('leaves a trusted payload intact and nulls the token otherwise', () => {
    expect(settingsPayloadForDelivery(payload, true)).toBe(payload);
    expect(settingsPayloadForDelivery(payload, false)).toEqual({
      settings: { accessToken: null, user: { id: '1' }, appearance: { mode: 'dark' } },
    });
    expect(payload.settings.accessToken).toBe('secret');
  });
});

describe('contentFrameAuthRulesFromEmbeds', () => {
  it('copies the embed flags used to decide token forwarding', () => {
    expect(
      contentFrameAuthRulesFromEmbeds([
        { embedUrl: 'https://files.example/', safeForAuthToken: true },
        { embedUrl: ' https://docs.example/api/docs/ ', ignoreMessages: true },
        { embedUrl: '   ' },
      ]),
    ).toEqual([
      { url: 'https://files.example/', safeForAuthToken: true, ignoreMessages: false },
      { url: 'https://docs.example/api/docs/', safeForAuthToken: false, ignoreMessages: true },
    ]);
  });
});
