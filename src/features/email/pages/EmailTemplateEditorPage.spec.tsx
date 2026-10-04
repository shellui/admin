import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { EmailTemplateEditorPage } from '@/features/email/pages/EmailTemplateEditorPage';

const api = vi.hoisted(() => ({
  fetchSettings: vi.fn(),
  fetchTemplates: vi.fn(),
  fetchCatalog: vi.fn(),
  fetchVersion: vi.fn(),
  fetchVersions: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'token',
}));

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({ api, canManage: true, baseUrl: 'https://email.shellui.com', companyId: 1 }),
}));

vi.mock('@/features/email/components/EmailTemplateEditor', () => ({
  EmailTemplateEditor: () => <div data-testid="editor" />,
}));

const magicLink = {
  service: 'identity',
  eventType: 'identity.auth.magic_link.requested',
  templateKey: 'identity.auth.magic_link',
  label: 'Magic link requested',
  laneClass: 'auth',
  defaultLane: 'auth',
  defaultEnabled: true,
  category: 'auth',
  defaultTtlSeconds: 900,
  variables: [],
  suggested: {},
};

function renderAt(path: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/email/templates/id/:templateId"
            element={<EmailTemplateEditorPage />}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EmailTemplateEditorPage header', () => {
  afterEach(() => {
    cleanup();
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('names the template and the event it is sent for', async () => {
    api.fetchSettings.mockResolvedValue({ theme: 'barebone', templatesUsingOtherTheme: 0 });
    api.fetchCatalog.mockResolvedValue({ events: [magicLink], authLinkHosts: [] });
    api.fetchTemplates.mockResolvedValue([
      {
        id: 7,
        templateKey: 'company.abc',
        name: 'Sign-in link',
        eventType: 'identity.auth.magic_link.requested',
        language: 'en',
        companyId: 1,
        activeVersion: 1,
        theme: 'barebone',
        usesCompanyTheme: true,
      },
    ]);
    api.fetchVersion.mockResolvedValue({
      number: 1,
      subject: 'Sign in',
      preheader: '',
      document: { preview: '', blocks: [] },
      themeName: 'barebone',
      themePalette: {},
    });

    renderAt('/email/templates/id/7');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign-in link' })).toBeTruthy();
    expect(screen.getByText('Sent for')).toBeTruthy();
    expect(screen.getByText('Magic link requested')).toBeTruthy();
    expect(screen.getByText('identity.auth.magic_link.requested')).toBeTruthy();
    expect(screen.getByText('Auth')).toBeTruthy();
    expect(screen.getByTestId('editor')).toBeTruthy();
  });
});
