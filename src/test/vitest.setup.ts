import { vi } from 'vitest';

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
