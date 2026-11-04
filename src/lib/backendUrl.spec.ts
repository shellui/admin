import shellui from '@shellui/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    expect(resolveAuthBackendBaseUrl(null, dev)).toBe('http://localhost:8001');
  });

  it('prefers VITE_IDENTITY_URL over the dev default', () => {
    vi.stubEnv('VITE_IDENTITY_URL', 'http://localhost:8999/');
    expect(resolveAuthBackendBaseUrl(undefined, dev)).toBe('http://localhost:8999');
    vi.unstubAllEnvs();
  });

  it('returns null in production when the shell omits the URL', () => {
    expect(resolveAuthBackendBaseUrl(undefined, prod)).toBeNull();
    expect(resolveAuthBackendBaseUrl('', prod)).toBeNull();
    expect(resolveAuthBackendBaseUrl('   ', prod)).toBeNull();
    expect(resolveAuthBackendBaseUrl(null, prod)).toBeNull();
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
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
