import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { EmailNewsletterPage } from '@/features/email/pages/EmailNewsletterPage';
import { parseNewsletter, parseSubscriberAdded, parseSubscriberPage } from '@/lib/emailNewsletters';

const api = vi.hoisted(() => ({
  fetchNewsletter: vi.fn(),
  patchNewsletter: vi.fn(),
  deleteNewsletter: vi.fn(),
  rotateNewsletterKey: vi.fn(),
  fetchSubscribers: vi.fn(),
  addSubscriber: vi.fn(),
  deleteSubscriber: vi.fn(),
  importSubscribers: vi.fn(),
  exportSubscribers: vi.fn(),
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

vi.mock('@/lib/confirmAction', () => ({ confirmAction: confirm }));
vi.mock('@/lib/shelluiConfirm', () => ({ askShelluiConfirm: confirm }));

vi.mock('@/features/email/components/EmailCopyEditor', () => ({
  EmailCopyEditor: ({ templateId }: { templateId: number }) => <p>Copy editor {templateId}</p>,
}));

function newsletter(overrides: Record<string, unknown> = {}) {
  return parseNewsletter({
    id: 3,
    name: 'Product news',
    public_key: 'nl_abc',
    default_language: 'en',
    allowed_origins: ['https://acme.com'],
    confirmation_template_id: 11,
    subscribe_url: 'https://email.shellui.com/api/v1/public/newsletters/nl_abc/subscribe',
    counts: { confirmed: 1, pending: 1, unsubscribed: 0 },
    sender: { from_email: 'hello@acme.com', error_code: '' },
    ...overrides,
  });
}

const subscribers = parseSubscriberPage({
  count: 2,
  page: 1,
  page_size: 50,
  results: [
    {
      id: 21,
      email: 'ada@example.com',
      language: 'en',
      status: 'confirmed',
      source: 'form',
      created_at: '2026-10-01T10:00:00Z',
      confirmed_at: '2026-10-01T10:05:00Z',
    },
    {
      id: 22,
      email: 'grace@example.com',
      language: 'fr',
      status: 'pending',
      source: 'admin',
      created_at: '2026-10-02T10:00:00Z',
    },
  ],
});

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/email/newsletters/3']}>
        <Routes>
          <Route
            path="/email/newsletters/:newsletterId"
            element={<EmailNewsletterPage />}
          />
          <Route
            path="/email/newsletters"
            element={<p>Newsletter list</p>}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EmailNewsletterPage', () => {
  afterEach(() => {
    cleanup();
    for (const fn of Object.values(api)) fn.mockReset();
    confirm.mockReset();
  });

  it('lists subscribers and adds someone with a confirmation email', async () => {
    api.fetchNewsletter.mockResolvedValue(newsletter());
    api.fetchSubscribers.mockResolvedValue(subscribers);
    api.addSubscriber.mockResolvedValue(
      parseSubscriberAdded({
        outcome: 'sent',
        subscriber: { id: 23, email: 'linus@example.com', status: 'pending' },
      }),
    );
    renderPage();
    expect(await screen.findByText('ada@example.com')).toBeTruthy();
    expect(screen.getByText('grace@example.com')).toBeTruthy();
    expect(screen.getByText('Website form')).toBeTruthy();
    expect(api.fetchSubscribers).toHaveBeenCalledWith(3, { status: '', email: '', page: 1 });

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'linus@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(api.addSubscriber).toHaveBeenCalledWith(3, {
        email: 'linus@example.com',
        mode: 'confirm',
      }),
    );
    expect(await screen.findByText('Confirmation email sent.')).toBeTruthy();
    expect(api.fetchNewsletter).toHaveBeenCalledTimes(2);
  });

  it('filters by status and removes a subscriber after confirmation', async () => {
    api.fetchNewsletter.mockResolvedValue(newsletter());
    api.fetchSubscribers.mockResolvedValue(subscribers);
    api.deleteSubscriber.mockResolvedValue(undefined);
    confirm.mockResolvedValue(true);
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Waiting 1' }));
    await waitFor(() =>
      expect(api.fetchSubscribers).toHaveBeenLastCalledWith(3, {
        status: 'pending',
        email: '',
        page: 1,
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Remove grace@example.com' }));
    await waitFor(() => expect(api.deleteSubscriber).toHaveBeenCalledWith(3, 22));
  });

  it('shows the sign-up endpoint and replaces the key', async () => {
    api.fetchNewsletter.mockResolvedValue(newsletter());
    api.fetchSubscribers.mockResolvedValue(subscribers);
    api.rotateNewsletterKey.mockResolvedValue(
      newsletter({
        public_key: 'nl_new',
        subscribe_url: 'https://email.shellui.com/api/v1/public/newsletters/nl_new/subscribe',
      }),
    );
    confirm.mockResolvedValue(true);
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Sign-up form' }));
    expect((screen.getByLabelText('Sign-up endpoint') as HTMLInputElement).value).toContain(
      '/newsletters/nl_abc/subscribe',
    );
    expect(
      screen.getByText(/Only these websites may post the form: https:\/\/acme.com/),
    ).toBeTruthy();
    expect(screen.getByText(/connect-src/).textContent).toContain('https://email.shellui.com');

    fireEvent.click(screen.getByRole('button', { name: 'Replace key' }));
    await waitFor(() => expect(api.rotateNewsletterKey).toHaveBeenCalledWith(3));
    expect(await screen.findByText('nl_new')).toBeTruthy();
    expect(screen.getByText('Key replaced. Update the form on your website.')).toBeTruthy();
  });

  it('edits the confirmation email with the copy editor', async () => {
    api.fetchNewsletter.mockResolvedValue(newsletter());
    api.fetchSubscribers.mockResolvedValue(subscribers);
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Confirmation email' }));
    expect(await screen.findByText('Copy editor 11')).toBeTruthy();
  });

  it('renames on blur and deletes after confirmation', async () => {
    api.fetchNewsletter.mockResolvedValue(newsletter());
    api.fetchSubscribers.mockResolvedValue(subscribers);
    api.patchNewsletter.mockResolvedValue(newsletter({ name: 'Changelog' }));
    api.deleteNewsletter.mockResolvedValue(undefined);
    confirm.mockResolvedValue(true);
    renderPage();
    const name = (await screen.findByLabelText('Name')) as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Changelog' } });
    fireEvent.blur(name);
    await waitFor(() => expect(api.patchNewsletter).toHaveBeenCalledWith(3, { name: 'Changelog' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.deleteNewsletter).toHaveBeenCalledWith(3));
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining('its 1 subscriber,') }),
    );
    expect(await screen.findByText('Newsletter list')).toBeTruthy();
  });
});
