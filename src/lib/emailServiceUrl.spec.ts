import { describe, expect, it } from 'vitest';
import {
  isEmailAdminEnabled,
  readSettingsEmail,
  resolveEmailServiceUrl,
} from '@/lib/emailServiceUrl';
import type { Settings } from '@shellui/sdk';

describe('resolveEmailServiceUrl', () => {
  it('has no default origin', () => {
    expect(resolveEmailServiceUrl(undefined)).toBeNull();
    expect(resolveEmailServiceUrl('  ')).toBeNull();
    expect(resolveEmailServiceUrl('http://localhost:8010/')).toBe('http://localhost:8010');
  });
});

describe('readSettingsEmail', () => {
  it('reads email.url from host settings the same way as storage and hosting', () => {
    const settings = {
      email: { url: 'http://localhost:8010/', showInAdmin: false },
    } as unknown as Settings;
    expect(readSettingsEmail(settings)).toEqual({
      url: 'http://localhost:8010',
      showInAdmin: false,
    });
  });

  it('returns null when the shell sends no email url', () => {
    expect(readSettingsEmail(undefined)).toBeNull();
    expect(readSettingsEmail({ email: null } as unknown as Settings)).toBeNull();
    expect(readSettingsEmail({ email: {} } as unknown as Settings)).toBeNull();
  });
});

describe('isEmailAdminEnabled', () => {
  it('requires a url', () => {
    expect(isEmailAdminEnabled(null)).toBe(false);
    expect(isEmailAdminEnabled({ url: '' } as never)).toBe(false);
    expect(isEmailAdminEnabled({ url: 'https://email.eu.shellui.com' })).toBe(true);
    expect(isEmailAdminEnabled({ url: 'https://email.eu.shellui.com', showInAdmin: false })).toBe(
      false,
    );
  });
});
