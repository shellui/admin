import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { EmailBroadcastPage } from '@/features/email/pages/EmailBroadcastPage';
import { parseBroadcast } from '@/lib/emailBroadcasts';
import { parseNewsletter } from '@/lib/emailNewsletters';

const api = vi.hoisted(() => ({
  fetchBroadcast: vi.fn(),
  patchBroadcast: vi.fn(),
  previewBroadcast: vi.fn(),
  sendBroadcast: vi.fn(),
  deleteBroadcast: vi.fn(),
  fetchVersions: vi.fn(),
  fetchNewsletters: vi.fn(),
}));
const confirm = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'token',
}));

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({ api, canManage: true, baseUrl: 'https://email.shellui.com', companyId: 1 }),
}));

vi.mock('@/lib/jwtCompany', () => ({
  getEmailFromJwt: () => 'owner@acme.com',
  getIsStaffFromJwt: () => false,
}));

vi.mock('@/lib/shelluiConfirm', () => ({ askShelluiConfirm: confirm }));

vi.mock('@/features/email/components/EmailCopyEditor', () => ({
  EmailCopyEditor: ({ templateId }: { templateId: number }) => <p>Copy editor {templateId}</p>,
}));

vi.mock('@/lib/adminGroupsApi', () => ({
  fetchAdminGroups: vi.fn(async () => [
    { id: 3, display_name: 'Beta testers', source: 'manual', user_count: 4 },
  ]),
}));

vi.mock('@/lib/adminUsersApi', () => ({
  fetchAdminUser: vi.fn(),
  fetchAdminUsers: vi.fn(async () => ({ count: 0, page: 1, page_size: 8, results: [] })),
}));

const sender = {
  from_email: 'news@news.acme.com',
  from_name: 'Acme',
  delivery: 'bulk_lane',
  error_code: '',
};

function draft(overrides: Record<string, unknown> = {}) {
  return parseBroadcast({
    id: 5,
    name: 'October news',
    state: 'draft',
    template_id: 9,
    language: 'en',
    audience: { mode: 'filter', access: 'enabled' },
    sender,
    ...overrides,
  });
}

const preview = {
  total: 5,
  sendable: 3,
  unsubscribed: 1,
  suppressed: 1,
  languages: { en: 2, fr: 1 },
  samples: ['a***@acme.com'],
};

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/email/broadcasts/5']}>
        <Routes>
          <Route
            path="/email/broadcasts/:broadcastId"
            element={<EmailBroadcastPage />}
          />
          <Route
            path="/email/broadcasts"
            element={<p>Broadcast list</p>}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EmailBroadcastPage', () => {
  afterEach(() => {
    cleanup();
    for (const fn of Object.values(api)) fn.mockReset();
    confirm.mockReset();
  });

  it('edits the content with the copy editor', async () => {
    api.fetchBroadcast.mockResolvedValue(draft());
    renderPage();
    expect(await screen.findByText('Copy editor 9')).toBeTruthy();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('October news');
  });

  it('targets a newsletter list and saves only that list', async () => {
    api.fetchBroadcast.mockResolvedValue(draft());
    api.previewBroadcast.mockResolvedValue(preview);
    api.fetchNewsletters.mockResolvedValue([
      parseNewsletter({ id: 4, name: 'Product news', counts: { confirmed: 7 } }),
      parseNewsletter({ id: 6, name: 'Changelog', counts: { confirmed: 2 } }),
    ]);
    api.patchBroadcast.mockImplementation(async (_id, body) => draft({ audience: body.audience }));
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Audience' }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Newsletter subscribers' }));
    await waitFor(() =>
      expect(api.previewBroadcast).toHaveBeenLastCalledWith(
        5,
        expect.objectContaining({ mode: 'newsletter', list_id: 4 }),
      ),
    );
    expect(screen.getByText(/Each subscriber gets the language they signed up in/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Changelog/));
    await waitFor(() =>
      expect(api.previewBroadcast).toHaveBeenLastCalledWith(
        5,
        expect.objectContaining({ mode: 'newsletter', list_id: 6 }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
    await waitFor(() =>
      expect(api.patchBroadcast).toHaveBeenCalledWith(5, {
        audience: expect.objectContaining({ mode: 'newsletter', list_id: 6, roles: [] }),
      }),
    );
  });

  it('builds the audience with a live preview per language, then saves it', async () => {
    api.fetchBroadcast.mockResolvedValue(draft());
    api.previewBroadcast.mockResolvedValue(preview);
    api.fetchNewsletters.mockResolvedValue([]);
    api.patchBroadcast.mockImplementation(async (_id, body) => draft({ audience: body.audience }));
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Audience' }));
    fireEvent.click(await screen.findByLabelText('Members'));
    fireEvent.click(await screen.findByLabelText(/Beta testers/));
    await waitFor(() =>
      expect(api.previewBroadcast).toHaveBeenLastCalledWith(
        5,
        expect.objectContaining({ roles: ['member'], group_ids: [3] }),
      ),
    );
    expect(await screen.findByText('people get this broadcast')).toBeTruthy();
    expect(screen.getByText(/English/).textContent).toContain('2');
    expect(screen.getByText(/French/).textContent).toContain('1');
    expect(screen.getByText(/1 unsubscribed, 1 suppressed/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
    await waitFor(() =>
      expect(api.patchBroadcast).toHaveBeenCalledWith(5, {
        audience: expect.objectContaining({ roles: ['member'], group_ids: [3] }),
      }),
    );
    expect(await screen.findByText('Audience saved.')).toBeTruthy();
  });

  it('sends after confirmation and shows the outcome', async () => {
    api.fetchBroadcast.mockResolvedValue(draft());
    api.previewBroadcast.mockResolvedValue(preview);
    api.fetchVersions.mockResolvedValue([{ number: 1, state: 'published' }]);
    api.sendBroadcast.mockResolvedValue(
      parseBroadcast({
        id: 5,
        name: 'October news',
        state: 'sent',
        delivery: 'bulk_lane',
        from_email: 'news@news.acme.com',
        template_id: 9,
        template_version: 1,
        counts: { total: 5, sent: 3, skipped_unsubscribed: 1, skipped_suppressed: 1 },
        sender,
      }),
    );
    confirm.mockResolvedValue(true);
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Send' }));
    expect(await screen.findByText('Acme <news@news.acme.com>')).toBeTruthy();
    expect(screen.queryByText(/send news from a subdomain/)).toBeNull();
    const send = screen.getByRole('button', { name: 'Send now' });
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(send);
    await waitFor(() => expect(api.sendBroadcast).toHaveBeenCalledWith(5));
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining('3 people') }),
    );
    expect(await screen.findByText('Skipped: unsubscribed')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Content' })).toBeNull();
  });

  it('explains a missing bulk sender and blocks sending', async () => {
    api.fetchBroadcast.mockResolvedValue(
      draft({
        sender: { ...sender, from_email: '', delivery: '', error_code: 'bulk_sender_required' },
      }),
    );
    api.previewBroadcast.mockResolvedValue(preview);
    api.fetchVersions.mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Send' }));
    expect(await screen.findByText(/Set a bulk from address/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open provider settings' }).getAttribute('href')).toBe(
      '/email/provider',
    );
    expect((screen.getByRole('button', { name: 'Send now' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
