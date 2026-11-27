import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Settings } from '@shellui/sdk';

const sdk = vi.hoisted(() => ({
  configureMessageSecurity: vi.fn(),
  initialSettings: null as unknown,
  listeners: new Map<string, (message: { payload?: unknown }, event: unknown) => void>(),
}));

// Same contract as the SDK helper: absolute http(s) URLs only, deduped origins.
vi.mock('@shellui/sdk', () => ({
  default: {
    configureMessageSecurity: sdk.configureMessageSecurity,
    get initialSettings() {
      return sdk.initialSettings;
    },
  },
  resolveParentTargetOrigin: () => 'https://shell.example',
  addMessageListener: (
    type: string,
    cb: (message: { payload?: unknown }, event: unknown) => void,
  ) => {
    sdk.listeners.set(type, cb);
    return () => sdk.listeners.delete(type);
  },
  collectOriginsFromUrls: (...urls: (string | null | undefined)[]) => {
    const origins = new Set<string>();
    for (const url of urls) {
      const trimmed = url?.trim();
      if (!trimmed || !/^https?:\/\//.test(trimmed)) continue;
      try {
        origins.add(new URL(trimmed).origin);
      } catch {
        // ignore invalid URLs
      }
    }
    return [...origins];
  },
}));

import { collectEmbeddedAppOrigins, setupEmbeddedAppMessageSecurity } from './embeddedAppOrigins';
import { snapshotTrustedShellSettings } from '@/lib/trustedShellSettings';

function settings(partial: Record<string, unknown>): Settings {
  return partial as unknown as Settings;
}

describe('collectEmbeddedAppOrigins', () => {
  it('returns nothing without settings', () => {
    expect(collectEmbeddedAppOrigins(null)).toEqual([]);
  });

  it('trusts the Files app origin when storage is configured', () => {
    const s = settings({
      storage: { url: 'https://storage.shellui.com', filesUrl: 'https://files.shellui.com/' },
    });
    expect(collectEmbeddedAppOrigins(s)).toEqual(['https://files.shellui.com']);
  });

  it('skips Files when storage.url is missing, like the nav', () => {
    const s = settings({ storage: { filesUrl: 'https://files.shellui.com/' } });
    expect(collectEmbeddedAppOrigins(s)).toEqual([]);
  });

  it('adds custom admin apps, resolves relative paths, skips external and staff-only for non-staff', () => {
    const s = settings({
      authBackendBaseUrl: 'https://identity.shellui.com',
      storage: { url: 'https://storage.shellui.com', filesUrl: 'https://files.shellui.com/' },
      administration: {
        navigation: [
          { label: 'Playground', path: 'pg', url: 'https://playground.shellui.com/#/' },
          { label: 'Same', path: 'pg2', url: 'https://playground.shellui.com/other' },
          { label: 'Relative', path: 'rel', url: '/custom/' },
          { label: 'Ext', path: 'ext', url: 'https://external.example.com', openIn: 'external' },
          { label: 'Staff', path: 'st', url: 'https://staff.example.com', requiresStaff: true },
          { label: 'Bad', path: 'bad', url: 'not a url' },
        ],
      },
    });
    expect(collectEmbeddedAppOrigins(s)).toEqual([
      'https://files.shellui.com',
      'https://playground.shellui.com',
      'https://identity.shellui.com',
    ]);
  });

  it('includes staff-only apps for staff', () => {
    const s = settings({
      user: { isStaff: true },
      administration: {
        navigation: [
          { label: 'Staff', path: 'st', url: 'https://staff.example.com', requiresStaff: true },
        ],
      },
    });
    expect(collectEmbeddedAppOrigins(s)).toEqual(['https://staff.example.com']);
  });
});

const parentEvent = { source: window.parent, origin: 'https://shell.example' };

describe('setupEmbeddedAppMessageSecurity', () => {
  beforeEach(() => {
    sdk.configureMessageSecurity.mockReset();
    sdk.listeners.clear();
  });

  it('configures from initial settings and replaces the full list on updates', () => {
    sdk.initialSettings = settings({
      storage: { url: 'https://storage.shellui.com', filesUrl: 'https://files.shellui.com/' },
    });
    snapshotTrustedShellSettings(sdk.initialSettings as object);
    const off = setupEmbeddedAppMessageSecurity();
    expect(sdk.configureMessageSecurity).toHaveBeenLastCalledWith({
      allowedOrigins: ['https://files.shellui.com'],
    });

    const widened = {
      payload: {
        settings: settings({
          storage: { url: 'https://storage.example.com', filesUrl: 'https://files.example.com' },
        }),
      },
    };
    // A child frame (any other source or origin) cannot change the allowlist.
    sdk.listeners.get('SHELLUI_SETTINGS_UPDATED')?.(widened, {
      source: {},
      origin: 'https://shell.example',
    });
    sdk.listeners.get('SHELLUI_SETTINGS_UPDATED')?.(widened, {
      source: window.parent,
      origin: 'https://files.shellui.com',
    });
    expect(sdk.configureMessageSecurity).toHaveBeenCalledTimes(1);

    sdk.listeners.get('SHELLUI_SETTINGS_UPDATED')?.(widened, parentEvent);
    expect(sdk.configureMessageSecurity).toHaveBeenLastCalledWith({
      allowedOrigins: ['https://files.example.com'],
    });

    sdk.listeners.get('SHELLUI_SETTINGS')?.({ payload: {} }, parentEvent);
    expect(sdk.configureMessageSecurity).toHaveBeenCalledTimes(2);

    off();
    expect(sdk.listeners.size).toBe(0);
  });
});
