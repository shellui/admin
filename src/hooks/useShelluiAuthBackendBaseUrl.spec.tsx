import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShelluiAuthBackendBaseUrl } from '@/hooks/useShelluiAuthBackendBaseUrl';

const sdk = vi.hoisted(() => {
  const listeners: { type: string; fn: (message: { payload?: unknown }) => void }[] = [];
  return {
    listeners,
    initialSettings: {
      authBackendBaseUrl: 'http://identity.example' as string | null,
    },
  };
});

vi.mock('@shellui/sdk', () => ({
  default: {
    get initialSettings() {
      return sdk.initialSettings;
    },
    set initialSettings(value: { authBackendBaseUrl: string | null }) {
      sdk.initialSettings = value;
    },
  },
  addMessageListener: (type: string, fn: (message: { payload?: unknown }) => void) => {
    const entry = { type, fn };
    sdk.listeners.push(entry);
    return () => {
      const index = sdk.listeners.indexOf(entry);
      if (index >= 0) sdk.listeners.splice(index, 1);
    };
  },
}));

function emit(type: string, settings: Record<string, unknown>) {
  for (const entry of sdk.listeners) {
    if (entry.type === type) entry.fn({ payload: { settings } });
  }
}

describe('useShelluiAuthBackendBaseUrl', () => {
  afterEach(() => {
    cleanup();
    sdk.listeners.splice(0, sdk.listeners.length);
    sdk.initialSettings = { authBackendBaseUrl: 'http://identity.example' };
  });

  it('reads the URL from this frame settings and keeps it when a later payload omits it', () => {
    const { result } = renderHook(() => useShelluiAuthBackendBaseUrl());
    expect(result.current).toBe('http://identity.example');

    act(() => {
      emit('SHELLUI_SETTINGS_UPDATED', { accessToken: 'next-token' });
    });
    expect(result.current).toBe('http://identity.example');

    act(() => {
      emit('SHELLUI_SETTINGS', { authBackendBaseUrl: 'https://identity.other/' });
    });
    expect(result.current).toBe('https://identity.other');
  });
});
