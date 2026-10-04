import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { EmailTemplatesPage } from '@/features/email/pages/EmailTemplatesPage';
import type { EmailLibraryTemplate } from '@/lib/emailTypes';

const api = vi.hoisted(() => ({
  fetchLibrary: vi.fn(),
  createLibraryTemplate: vi.fn(),
  deleteLibraryTemplate: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'token',
}));

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({
    api,
    canManage: true,
    baseUrl: 'https://email.shellui.com',
    companyId: 1,
  }),
}));

function template(overrides: Partial<EmailLibraryTemplate>): EmailLibraryTemplate {
  return {
    id: 1,
    key: 'barebone.welcome',
    set: 'barebone',
    name: 'Welcome',
    builtIn: true,
    companyId: null,
    subject: 'Welcome to {{ company_name }}',
    preheader: '',
    updatedAt: null,
    html: '<img src="{{ system.assets_url }}/logo.png"><p>{{ company_name }}</p>',
    ...overrides,
  };
}

const library = {
  sets: [
    { key: 'barebone', name: 'Barebone' },
    { key: 'studio', name: 'Studio' },
  ],
  templates: [
    template({ id: 1 }),
    template({ id: 2, key: 'studio.reset', set: 'studio', name: 'Password reset' }),
    template({ id: 9, key: 'company.a1', name: 'Acme welcome', builtIn: false, companyId: 1 }),
  ],
};

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/email/templates']}>
        <Routes>
          <Route
            path="/email/templates"
            element={<EmailTemplatesPage />}
          />
          <Route
            path="/email/templates/:libraryId"
            element={<p>Library template</p>}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

function card(name: string): HTMLElement {
  return screen.getByText(name).closest('li') as HTMLElement;
}

describe('EmailTemplatesPage', () => {
  afterEach(async () => {
    cleanup();
    for (const fn of Object.values(api)) fn.mockReset();
    await i18n.changeLanguage('en');
  });

  it('shows company templates first, then built-ins by set, with scriptless previews', async () => {
    api.fetchLibrary.mockResolvedValue(library);
    renderPage();
    const sections = await screen.findAllByRole('region');
    expect(sections.map((section) => section.getAttribute('aria-label'))).toEqual([
      'Company templates',
      'Barebone',
      'Studio',
    ]);
    const frame = screen.getByTitle('Welcome');
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.getAttribute('srcdoc')).toContain(
      'src="https://email.shellui.com/static/library/logo.png"',
    );
    expect(frame.getAttribute('srcdoc')).toContain('<p>Acme</p>');

    expect(within(card('Welcome')).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(within(card('Welcome')).getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(
      '/email/templates/1',
    );
    expect(within(card('Acme welcome')).getByRole('link', { name: 'Edit' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Studio' }));
    expect(screen.queryByText('Welcome')).toBeNull();
    expect(screen.getByText('Password reset')).toBeTruthy();
  });

  it('creates a blank template or a duplicate, and opens it', async () => {
    api.fetchLibrary.mockResolvedValue(library);
    api.createLibraryTemplate.mockResolvedValue({ ...template({ id: 12, builtIn: false }) });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'New template' }));
    expect(await screen.findByText('Library template')).toBeTruthy();
    expect(api.createLibraryTemplate).toHaveBeenCalledWith({ name: 'Untitled template' });

    cleanup();
    renderPage();
    await screen.findByText('Password reset');
    fireEvent.click(within(card('Password reset')).getByRole('button', { name: 'Duplicate' }));
    await waitFor(() =>
      expect(api.createLibraryTemplate).toHaveBeenLastCalledWith({ source_id: 2 }),
    );
  });

  it('deletes a company template after confirmation and filters by search', async () => {
    api.fetchLibrary.mockResolvedValue(library);
    api.deleteLibraryTemplate.mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByText('Acme welcome');
    fireEvent.click(within(card('Acme welcome')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.deleteLibraryTemplate).toHaveBeenCalledWith(9));
    await waitFor(() => expect(screen.queryByText('Acme welcome')).toBeNull());
    confirm.mockRestore();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search templates' }), {
      target: { value: 'reset' },
    });
    expect(screen.queryByText('Welcome')).toBeNull();
    expect(screen.getByText('Password reset')).toBeTruthy();
  });
});
