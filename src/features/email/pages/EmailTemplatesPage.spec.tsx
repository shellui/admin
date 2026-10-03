import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import shellui from '@shellui/sdk';
import i18n from '@/i18n';
import { EmailTemplatesPage } from '@/features/email/pages/EmailTemplatesPage';

const api = vi.hoisted(() => ({
  fetchThemes: vi.fn(),
  fetchSettings: vi.fn(),
  fetchTemplates: vi.fn(),
  fetchThemePreview: vi.fn(),
  saveSettings: vi.fn(),
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

const themes = ['barebone', 'matte', 'protocol', 'arcane', 'studio'].map((key) => ({
  key,
  name: key[0]?.toUpperCase() + key.slice(1),
  previewUrl: `/api/v1/themes/${key}/preview?language=en`,
}));

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <EmailTemplatesPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EmailTemplatesPage', () => {
  afterEach(async () => {
    cleanup();
    api.fetchThemes.mockReset();
    api.fetchSettings.mockReset();
    api.fetchTemplates.mockReset();
    api.fetchThemePreview.mockReset();
    api.saveSettings.mockReset();
    await i18n.changeLanguage('en');
  });

  it('shows theme previews in a scriptless iframe and company templates', async () => {
    shellui.dialog = vi.fn();
    api.fetchThemes.mockResolvedValue(themes);
    api.fetchSettings.mockResolvedValue({ theme: 'matte', templatesUsingOtherTheme: 0 });
    api.fetchTemplates.mockResolvedValue([
      {
        id: 15,
        templateKey: 'company.abc',
        name: 'Deploy notice',
        eventType: 'hosting.deployment.failed',
        language: 'en',
        companyId: 1,
        activeVersion: 1,
        theme: 'protocol',
        usesCompanyTheme: false,
      },
    ]);
    api.fetchThemePreview.mockImplementation(async (url: string) => {
      if (url.includes('protocol')) throw new Error('preview down');
      return '<p>Preview</p>';
    });
    api.saveSettings.mockResolvedValue({ theme: 'protocol', updatedTemplates: 0 });

    renderPage();
    expect(await screen.findByText('Deploy notice')).toBeTruthy();
    expect(screen.getByText('hosting.deployment.failed')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('Uses Protocol')).toBeTruthy();
    expect(screen.queryByText('Suggested')).toBeNull();

    const frame = await screen.findByTitle('Barebone');
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(await screen.findByText('Preview unavailable.')).toBeTruthy();
    expect(screen.getByText('Deploy notice')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Protocol/ }));
    await waitFor(() =>
      expect(api.saveSettings).toHaveBeenCalledWith({
        theme: 'protocol',
        apply_to_existing: false,
      }),
    );
    expect(shellui.dialog).not.toHaveBeenCalled();
    expect(await screen.findByText('Theme updated.')).toBeTruthy();
  });
});
