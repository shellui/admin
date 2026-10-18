import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmailApiClient } from '@/lib/emailApi';
import {
  requireAbsoluteServiceUrl,
  ServiceUrlNotConfiguredError,
  serviceAuthFetch,
} from '@/lib/serviceAuthFetch';

describe('requireAbsoluteServiceUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts an absolute http(s) URL and rejects anything else', () => {
    expect(requireAbsoluteServiceUrl('https://identity.example/')).toBe('https://identity.example');
    expect(requireAbsoluteServiceUrl('http://localhost:8000')).toBe('http://localhost:8000');
    expect(() => requireAbsoluteServiceUrl(null)).toThrow(ServiceUrlNotConfiguredError);
    expect(() => requireAbsoluteServiceUrl('')).toThrow(ServiceUrlNotConfiguredError);
    expect(() => requireAbsoluteServiceUrl('/api/v1')).toThrow(ServiceUrlNotConfiguredError);
    expect(() => requireAbsoluteServiceUrl('javascript:alert(1)')).toThrow(
      ServiceUrlNotConfiguredError,
    );
  });

  it('does not send the session token when the service URL is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(serviceAuthFetch(null, '/api/v1/users', 'secret-token')).rejects.toBeInstanceOf(
      ServiceUrlNotConfiguredError,
    );
    await expect(serviceAuthFetch('  ', '/api/v1/users', 'secret-token')).rejects.toBeInstanceOf(
      ServiceUrlNotConfiguredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the session token only to the URL from settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await serviceAuthFetch('https://identity.example/', '/api/v1/users', 'secret-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://identity.example/api/v1/users');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer secret-token');
  });

  it('does not call email-service when the URL is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = createEmailApiClient('', 'secret-token', 7);
    await expect(client.fetchCatalog()).rejects.toBeInstanceOf(ServiceUrlNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
