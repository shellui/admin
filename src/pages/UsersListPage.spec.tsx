import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { UsersListPage } from '@/pages/UsersListPage';

const h = vi.hoisted(() => ({
  toast: vi.fn(),
  fetchUsers: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@shellui/sdk', () => ({ default: { toast: h.toast, dialog: vi.fn() } }));
vi.mock('@/hooks/useShelluiAccessToken', () => ({ useShelluiAccessToken: () => 'tok' }));
vi.mock('@/components/PendingInvitationsButton', () => ({ PendingInvitationsButton: () => null }));
vi.mock('@/lib/adminUsersApi', () => ({
  fetchAdminUsers: h.fetchUsers,
  updateAdminUser: h.updateUser,
}));

const row = {
  id: 3,
  email: 'jonas@acme.test',
  username: 'jonas',
  first_name: 'Jonas',
  last_name: 'Weber',
  is_active: false,
  is_company_owner: false,
  user_metadata: {},
  groups: [{ id: 1, name: 'analysts' }],
};

function renderPage(path = '/users') {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <UsersListPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('UsersListPage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lists users with initials and toggles company access with a toast', async () => {
    h.fetchUsers.mockResolvedValue({ count: 1, results: [row] });
    h.updateUser.mockResolvedValue({ ...row, is_active: true });
    renderPage();
    expect(await screen.findByRole('link', { name: /open profile: jonas weber/i })).toBeTruthy();
    expect(screen.getByText('JW')).toBeTruthy();
    expect(screen.getByText('analysts')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: /company access for jonas weber/i }));
    await waitFor(() => expect(h.updateUser).toHaveBeenCalledWith('tok', 3, { is_active: true }));
    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Company access enabled (user notified by email)' }),
      ),
    );
  });

  it('shows the search empty state with a clear action', async () => {
    h.fetchUsers.mockResolvedValue({ count: 0, results: [] });
    renderPage('/users?q=nobody');
    expect(await screen.findByText('No users match this search.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /clear search/i }).length).toBeGreaterThan(0);
  });

  it('shows the load error with a retry', async () => {
    h.fetchUsers.mockRejectedValueOnce(new Error('Boom'));
    h.fetchUsers.mockResolvedValue({ count: 0, results: [] });
    renderPage();
    expect(await screen.findByText('Boom')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('No users yet')).toBeTruthy();
  });
});
