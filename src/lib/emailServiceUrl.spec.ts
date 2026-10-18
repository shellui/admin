import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EMAIL_SERVICE_URL,
  readSettingsEmail,
  resolveEmailServiceUrl,
} from '@/lib/emailServiceUrl';
import type { Settings } from '@shellui/sdk';

const prod = { dev: false };
const dev = { dev: true };

describe('resolveEmailServiceUrl', () => {
  it('uses an explicit URL from shell settings', () => {
    expect(resolveEmailServiceUrl('http://localhost:8010/', dev)).toBe('http://localhost:8010');
    expect(resolveEmailServiceUrl('https://email.example/', prod)).toBe('https://email.example');
  });

  it('keeps the local dev default only when the shell omits email.url', () => {
    expect(DEFAULT_EMAIL_SERVICE_URL).toBe('http://localhost:8003');
    expect(resolveEmailServiceUrl(undefined, dev)).toBe('http://localhost:8003');
    expect(resolveEmailServiceUrl('  ', dev)).toBe(DEFAULT_EMAIL_SERVICE_URL);
  });

  it('returns null in production when the shell omits email.url', () => {
    expect(resolveEmailServiceUrl(undefined, prod)).toBeNull();
    expect(resolveEmailServiceUrl('  ', prod)).toBeNull();
    expect(readSettingsEmail(undefined, prod).url).toBeNull();
  });

  it('reads email.url from host settings the same way as storage and hosting', () => {
    const settings = {
      email: { url: 'http://localhost:8010/', showInAdmin: false },
    } as unknown as Settings;
    expect(readSettingsEmail(settings, prod)).toEqual({
      url: 'http://localhost:8010',
      showInAdmin: false,
    });
    expect(readSettingsEmail(undefined, dev).url).toBe(DEFAULT_EMAIL_SERVICE_URL);
  });
});
