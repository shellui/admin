import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { EmailNewslettersPage } from '@/features/email/pages/EmailNewslettersPage';
import { parseNewsletter } from '@/lib/emailNewsletters';

const api = vi.hoisted(() => ({
  fetchNewsletters: vi.fn(),
  createNewsletter: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'token',
}));

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({ api, canManage: true, baseUrl: 'https://email.shellui.com', companyId: 1 }),
}));

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/email/newsletters']}>
        <Routes>
          <Route
            path="/email/newsletters"
            element={<EmailNewslettersPage />}
          />
          <Route
            path="/email/newsletters/:newsletterId"
            element={<p>Newsletter page</p>}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EmailNewslettersPage', () => {
  afterEach(() => {
    cleanup();
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('lists newsletters with their subscriber counts', async () => {
    api.fetchNewsletters.mockResolvedValue([
      parseNewsletter({
        id: 3,
        name: 'Product news',
        description: 'Monthly',
        counts: { confirmed: 12, pending: 2, unsubscribed: 0 },
      }),
    ]);
    renderPage();
    const link = await screen.findByRole('link', { name: /Product news/ });
    expect(link.getAttribute('href')).toBe('/email/newsletters/3');
    expect(link.textContent).toContain('12 subscribers');
    expect(link.textContent).toContain('2 waiting for confirmation');
    expect(link.textContent).not.toContain('unsubscribed');
  });

  it('asks for a name, then creates the newsletter and opens it', async () => {
    api.fetchNewsletters.mockResolvedValue([]);
    api.createNewsletter.mockResolvedValue(parseNewsletter({ id: 8, name: 'Changelog' }));
    renderPage();
    expect(await screen.findByText('No newsletters yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New newsletter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Give the newsletter a name first.')).toBeTruthy();
    expect(api.createNewsletter).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Changelog ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(api.createNewsletter).toHaveBeenCalledWith({
        name: 'Changelog',
        default_language: 'en',
      }),
    );
    expect(await screen.findByText('Newsletter page')).toBeTruthy();
  });
});
