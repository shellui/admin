import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getContentFrameAuthRules, setContentFrameAuthRules } from '@/lib/contentFrameAuth';

vi.mock('@/hooks/useShelluiDeveloperMode', () => ({
  useShelluiDeveloperMode: () => true,
}));

vi.mock('@/hooks/useShelluiIsStaff', () => ({
  useShelluiIsStaff: () => true,
}));

vi.mock('@/hooks/useShelluiAdministration', () => ({
  useShelluiAdministration: () => ({
    title: 'Applications',
    navigation: [
      {
        label: 'Billing',
        path: 'billing',
        url: 'https://billing.example/',
        safeForAuthToken: true,
      },
      {
        label: 'Notes',
        path: 'notes',
        url: 'https://notes.example/',
      },
      {
        label: 'Django',
        path: 'django-admin',
        url: '/admin/',
        openIn: 'external',
        safeForAuthToken: true,
      },
    ],
  }),
}));

vi.mock('@/hooks/useShelluiStorage', () => ({
  useShelluiStorage: () => ({
    url: 'https://storage.example',
    filesUrl: 'https://files.example/',
  }),
}));

vi.mock('@/hooks/useShelluiHosting', () => ({
  useShelluiHosting: () => ({ url: 'https://hosting.example', showInAdmin: true }),
  isHostingAdminEnabled: (hosting: { url?: string; showInAdmin?: boolean } | null) =>
    Boolean(hosting?.url?.trim()) && hosting?.showInAdmin !== false,
}));

vi.mock('@/hooks/useShelluiAuthBackendBaseUrl', () => ({
  useShelluiAuthBackendBaseUrl: () => 'https://id.example',
}));

vi.mock('@/lib/backendUrl', () => ({
  getAuthBackendBaseUrl: () => 'https://id.example',
}));

import { useAdminContentNavigation } from '@/hooks/useAdminContentNavigation';

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/users']}>{children}</MemoryRouter>;
}

describe('useAdminContentNavigation frame auth rules', () => {
  afterEach(() => {
    cleanup();
    setContentFrameAuthRules([]);
  });

  it('marks files and Swagger safe for the access token, and custom apps only when the host does', () => {
    renderHook(() => useAdminContentNavigation(), { wrapper });
    const rules = getContentFrameAuthRules();
    const byUrl = Object.fromEntries(rules.map((rule) => [rule.url.trim(), rule]));

    expect(byUrl['https://files.example/']).toMatchObject({ safeForAuthToken: true });
    expect(byUrl['https://id.example/api/docs/']).toMatchObject({
      safeForAuthToken: true,
      ignoreMessages: true,
    });
    expect(byUrl['https://id.example/api/docs/redoc/']).toMatchObject({
      safeForAuthToken: false,
      ignoreMessages: true,
    });
    expect(byUrl['https://storage.example/api/docs/']).toMatchObject({
      safeForAuthToken: true,
      ignoreMessages: true,
    });
    expect(byUrl['https://hosting.example/api/docs/']).toMatchObject({
      safeForAuthToken: true,
      ignoreMessages: true,
    });
    expect(byUrl['https://hosting.example/api/docs/redoc/']).toMatchObject({
      safeForAuthToken: false,
      ignoreMessages: true,
    });
    expect(byUrl['https://billing.example/']).toMatchObject({ safeForAuthToken: true });
    expect(byUrl['https://notes.example/']).toMatchObject({ safeForAuthToken: false });
    expect(rules.some((rule) => rule.url.includes('/admin/'))).toBe(false);
  });
});
