import shellui from '@shellui/sdk';
import { describe, expect, it } from 'vitest';
import {
  DEV_AUTH_BACKEND_BASE_URL,
  getAuthBackendBaseUrl,
  hydrateAuthBackendBaseUrlFromSdk,
  resolveAuthBackendBaseUrl,
} from '@/lib/backendUrl';

const prod = { dev: false };
const dev = { dev: true };

describe('resolveAuthBackendBaseUrl', () => {
  it('uses the URL from shell settings in dev and production', () => {
    expect(resolveAuthBackendBaseUrl('http://identity.example/', dev)).toBe(
      'http://identity.example',
    );
    expect(resolveAuthBackendBaseUrl(' http://identity.example/ ', prod)).toBe(
      'http://identity.example',
    );
  });

  it('keeps the dev default only when the shell omits the URL', () => {
    expect(resolveAuthBackendBaseUrl(undefined, dev)).toBe(DEV_AUTH_BACKEND_BASE_URL);
    expect(resolveAuthBackendBaseUrl('  ', dev)).toBe(DEV_AUTH_BACKEND_BASE_URL);
    expect(resolveAuthBackendBaseUrl(null, dev)).toBe('http://localhost:8000');
  });

  it('returns null in production when the shell omits the URL', () => {
    expect(resolveAuthBackendBaseUrl(undefined, prod)).toBeNull();
    expect(resolveAuthBackendBaseUrl('', prod)).toBeNull();
    expect(resolveAuthBackendBaseUrl('   ', prod)).toBeNull();
    expect(resolveAuthBackendBaseUrl(null, prod)).toBeNull();
  });
});

describe('getAuthBackendBaseUrl', () => {
  it('returns the identity URL from this frame settings', () => {
    const previous = shellui.initialSettings;
    shellui.initialSettings = {
      ...previous,
      authBackendBaseUrl: 'https://id.example/',
    } as typeof previous;
    hydrateAuthBackendBaseUrlFromSdk();
    expect(getAuthBackendBaseUrl()).toBe('https://id.example');
    shellui.initialSettings = previous;
    hydrateAuthBackendBaseUrlFromSdk();
  });
});
