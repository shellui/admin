import { vi } from 'vitest';

vi.mock('@shellui/sdk', () => ({
  default: {
    initialSettings: {
      authBackendBaseUrl: 'http://localhost:8000',
    },
  },
  addMessageListener: () => () => {},
}));
