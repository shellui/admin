import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EMAIL_SERVICE_URL,
  readSettingsEmail,
  resolveEmailServiceUrl,
} from '@/lib/emailServiceUrl';
import type { Settings } from '@shellui/sdk';

describe('resolveEmailServiceUrl', () => {
  it('defaults to the production origin', () => {
    expect(resolveEmailServiceUrl(undefined)).toBe(DEFAULT_EMAIL_SERVICE_URL);
    expect(resolveEmailServiceUrl('  ')).toBe('https://email.shellui.com');
    expect(resolveEmailServiceUrl('http://localhost:8010/')).toBe('http://localhost:8010');
  });

  it('reads email.url from host settings the same way as storage and hosting', () => {
    const settings = {
      email: { url: 'http://localhost:8010/', showInAdmin: false },
    } as unknown as Settings;
    expect(readSettingsEmail(settings)).toEqual({
      url: 'http://localhost:8010',
      showInAdmin: false,
    });
    expect(readSettingsEmail(undefined).url).toBe(DEFAULT_EMAIL_SERVICE_URL);
  });
});
