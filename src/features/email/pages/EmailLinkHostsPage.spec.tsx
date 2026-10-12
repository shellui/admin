import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { EmailLinkHostsPage } from '@/features/email/pages/EmailLinkHostsPage';
import { EmailApiError } from '@/lib/emailApiErrors';
import type { AuthLinkHosts } from '@/lib/emailTypes';

const loaded: AuthLinkHosts = {
  companyId: 42,
  hosts: ['playground.shellui.com'],
  applicationHosts: ['app.acme.com'],
  platformHosts: ['id.shellui.com'],
  authLinkHosts: ['app.acme.com', 'id.shellui.com', 'playground.shellui.com'],
};

const api = vi.hoisted(() => ({
  fetchAuthLinkHosts: vi.fn(),
  saveAuthLinkHosts: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'token',
}));

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({
    api,
    companyId: 42,
    baseUrl: 'https://email.shellui.com',
    canManage: true,
  }),
}));

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <EmailLinkHostsPage />
    </I18nextProvider>,
  );
}

describe('EmailLinkHostsPage', () => {
  afterEach(async () => {
    cleanup();
    api.fetchAuthLinkHosts.mockReset();
    api.saveAuthLinkHosts.mockReset();
    await i18n.changeLanguage('en');
  });

  it('shows the effective list and read-only application hosts', async () => {
    api.fetchAuthLinkHosts.mockResolvedValue(loaded);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Allowed link hosts' })).toBeTruthy();
    expect(screen.getAllByText('app.acme.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('id.shellui.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('playground.shellui.com').length).toBeGreaterThan(0);
    expect(screen.getByText(/Synced from identity/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove app.acme.com' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove playground.shellui.com' })).toBeTruthy();
  });

  it('rejects a scheme next to Add and does not call the service', async () => {
    api.fetchAuthLinkHosts.mockResolvedValue(loaded);
    renderPage();
    await screen.findByRole('heading', { name: 'Allowed link hosts' });
    fireEvent.change(screen.getByLabelText('Hostname'), {
      target: { value: 'https://app.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add hostname' }));
    const failure = await screen.findByText('Do not include a scheme. Enter the hostname only.');
    expect(failure.className).toContain('text-destructive');
    expect(
      screen.getByRole('button', { name: 'Add hostname' }).parentElement?.contains(failure),
    ).toBe(true);
    expect(api.saveAuthLinkHosts).not.toHaveBeenCalled();
    expect(screen.queryAllByText('Do not include a scheme. Enter the hostname only.')).toHaveLength(
      1,
    );
  });

  it('adds a hostname and shows success next to Add', async () => {
    api.fetchAuthLinkHosts.mockResolvedValue(loaded);
    api.saveAuthLinkHosts.mockResolvedValue({
      ...loaded,
      hosts: ['app.example.com', 'playground.shellui.com'],
      authLinkHosts: [
        'app.acme.com',
        'app.example.com',
        'id.shellui.com',
        'playground.shellui.com',
      ],
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Allowed link hosts' });
    fireEvent.change(screen.getByLabelText('Hostname'), {
      target: { value: 'APP.Example.COM' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add hostname' }));
    const success = await screen.findByText('Hostname added.');
    expect(api.saveAuthLinkHosts).toHaveBeenCalledWith([
      'app.example.com',
      'playground.shellui.com',
    ]);
    expect(success.className).not.toContain('text-destructive');
    expect(
      screen.getByRole('button', { name: 'Add hostname' }).parentElement?.contains(success),
    ).toBe(true);
    expect(screen.getAllByText('app.example.com').length).toBeGreaterThan(0);
  });

  it('shows a server error next to the Remove button that failed', async () => {
    api.fetchAuthLinkHosts.mockResolvedValue(loaded);
    api.saveAuthLinkHosts.mockRejectedValue(
      new EmailApiError('validation_failed', 400, { hosts: ['too_many'] }),
    );
    renderPage();
    await screen.findByRole('heading', { name: 'Allowed link hosts' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove playground.shellui.com' }));
    const failure = await screen.findByText('At most 32 hostnames.');
    const remove = screen.getByRole('button', { name: 'Remove playground.shellui.com' });
    expect(remove.parentElement?.contains(failure)).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(api.saveAuthLinkHosts).toHaveBeenCalledWith([]));
  });

  it('uses the French title', async () => {
    await i18n.changeLanguage('fr');
    api.fetchAuthLinkHosts.mockResolvedValue({
      ...loaded,
      hosts: [],
      authLinkHosts: ['id.shellui.com'],
    });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Hôtes de liens autorisés' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ajouter un hôte' })).toBeTruthy();
  });
});
