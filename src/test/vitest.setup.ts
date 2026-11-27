import { afterEach, beforeEach, vi } from 'vitest';
import {
  resetTrustedShellSettings,
  snapshotTrustedShellSettings,
} from '@/lib/trustedShellSettings';

vi.mock('@shellui/sdk', () => ({
  default: {
    initialSettings: {
      authBackendBaseUrl: 'http://localhost:8000',
    },
    toast: vi.fn(),
    openDrawer: vi.fn(),
    closeDrawer: vi.fn(),
  },
  addMessageListener: () => () => {},
  resolveParentTargetOrigin: () => (typeof window === 'undefined' ? null : window.location.origin),
  sendMessageToParent: () => false,
}));

beforeEach(async () => {
  const mod: { default?: { initialSettings?: unknown } } = await import('@shellui/sdk');
  let settings = null;
  try {
    settings = mod.default?.initialSettings ?? null;
  } catch {
    settings = null;
  }
  snapshotTrustedShellSettings(settings);
});

afterEach(() => {
  resetTrustedShellSettings();
});
