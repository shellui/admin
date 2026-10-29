import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { HostingDeployTokensPanel } from '@/components/HostingDeployTokensPanel';

const api = vi.hoisted(() => ({
  fetchHostingDeployTokens: vi.fn(),
  createHostingDeployToken: vi.fn(),
  revokeHostingDeployToken: vi.fn(),
}));

vi.mock('@/lib/hostingApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/hostingApi')>()),
  ...api,
}));
vi.mock('@shellui/sdk', () => ({ default: { toast: vi.fn() } }));
vi.mock('@/lib/shelluiConfirm', () => ({ askShelluiConfirm: vi.fn(async () => true) }));

const row = {
  id: 't1',
  app_id: 'a1',
  name: 'GitHub Actions',
  prefix: 'shellui_dt_abcd1234',
  created_by_id: 1,
  created_at: '2026-10-01T00:00:00Z',
  last_used_at: null,
  expires_at: null,
  revoked_at: null,
};

function renderPanel() {
  return render(
    <I18nextProvider i18n={i18n}>
      <HostingDeployTokensPanel
        hostingBaseUrl="https://hosting.test"
        accessToken="jwt"
        appRef="my-app"
      />
    </I18nextProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HostingDeployTokensPanel', () => {
  it('lists tokens and the CI workflow', async () => {
    api.fetchHostingDeployTokens.mockResolvedValue([row]);
    renderPanel();
    expect(await screen.findByText('GitHub Actions')).toBeTruthy();
    expect(screen.getByText(/SHELLUI_DEPLOY_TOKEN: \$\{\{ secrets/)).toBeTruthy();
  });

  it('shows a new token once and clears it on dismiss', async () => {
    api.fetchHostingDeployTokens.mockResolvedValue([]);
    api.createHostingDeployToken.mockResolvedValue({ ...row, token: 'shellui_dt_secret' });
    renderPanel();
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'CI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));
    expect(await screen.findByText('shellui_dt_secret')).toBeTruthy();
    expect(api.createHostingDeployToken).toHaveBeenCalledWith(
      'https://hosting.test',
      'jwt',
      'my-app',
      {
        name: 'CI',
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByText('shellui_dt_secret')).toBeNull());
  });

  it('revokes a token', async () => {
    api.fetchHostingDeployTokens.mockResolvedValue([row]);
    api.revokeHostingDeployToken.mockResolvedValue({ ...row, revoked_at: '2026-10-02T00:00:00Z' });
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    await waitFor(() =>
      expect(api.revokeHostingDeployToken).toHaveBeenCalledWith(
        'https://hosting.test',
        'jwt',
        'my-app',
        't1',
      ),
    );
  });
});
