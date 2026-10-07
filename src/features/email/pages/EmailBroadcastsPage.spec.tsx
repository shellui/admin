import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { EmailBroadcastsPage } from '@/features/email/pages/EmailBroadcastsPage';
import { parseBroadcast } from '@/lib/emailBroadcasts';

const api = vi.hoisted(() => ({
  fetchBroadcasts: vi.fn(),
  fetchLibrary: vi.fn(),
  createBroadcast: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'token',
}));

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({ api, canManage: true, baseUrl: 'https://email.shellui.com', companyId: 1 }),
}));

const library = {
  sets: [{ key: 'barebone', name: 'Barebone' }],
  templates: [
    {
      id: 1,
      key: 'barebone.product-update',
      set: 'barebone',
      name: 'Product update',
      builtIn: true,
      companyId: null,
      subject: '',
      preheader: '',
      updatedAt: null,
      html: '<p>Update</p>',
    },
  ],
};

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/email/broadcasts']}>
        <Routes>
          <Route
            path="/email/broadcasts"
            element={<EmailBroadcastsPage />}
          />
          <Route
            path="/email/broadcasts/:broadcastId"
            element={<p>Broadcast page</p>}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EmailBroadcastsPage', () => {
  afterEach(() => {
    cleanup();
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('lists broadcasts with their state and recipients', async () => {
    api.fetchBroadcasts.mockResolvedValue([
      parseBroadcast({
        id: 2,
        name: 'Launch',
        state: 'sent',
        counts: { total: 12 },
        created_at: '2026-10-01T10:00:00Z',
        sent_at: '2026-10-02T10:00:00Z',
      }),
      parseBroadcast({
        id: 1,
        name: 'Draft news',
        state: 'draft',
        created_at: '2026-10-01T10:00:00Z',
      }),
    ]);
    renderPage();
    const launch = await screen.findByRole('link', { name: /Launch/ });
    expect(launch.getAttribute('href')).toBe('/email/broadcasts/2');
    expect(launch.textContent).toContain('12 recipients');
    expect(launch.textContent).toContain('Sent');
    expect(screen.getByRole('link', { name: /Draft news/ }).textContent).toContain('Draft');
  });

  it('asks for a name, then creates from the picked design and opens it', async () => {
    api.fetchBroadcasts.mockResolvedValue([]);
    api.fetchLibrary.mockResolvedValue(library);
    api.createBroadcast.mockResolvedValue(parseBroadcast({ id: 7, name: 'News', state: 'draft' }));
    renderPage();
    expect(await screen.findByText('No broadcasts yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New broadcast' }));
    const design = await screen.findByText('Product update');
    fireEvent.click(design);
    expect(await screen.findByText('Give the broadcast a name first.')).toBeTruthy();
    expect(api.createBroadcast).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'News' } });
    fireEvent.click(screen.getByText('Product update'));
    await waitFor(() =>
      expect(api.createBroadcast).toHaveBeenCalledWith({
        name: 'News',
        source_key: 'barebone.product-update',
        language: 'en',
      }),
    );
    expect(await screen.findByText('Broadcast page')).toBeTruthy();
  });
});
