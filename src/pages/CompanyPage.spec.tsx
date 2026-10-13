import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { CompanyPage } from '@/pages/CompanyPage';

const session = vi.hoisted(() => ({ token: null as string | null }));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => session.token,
}));

function token(metadata: Record<string, unknown>): string {
  const body = btoa(JSON.stringify({ company_id: 7, user_metadata: metadata }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `h.${body}.s`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CompanyPage desktop sign-in schemes', () => {
  afterEach(() => {
    cleanup();
    session.token = null;
    vi.unstubAllGlobals();
  });

  function renderPage() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/auth-methods')) {
          return jsonResponse({
            enable_magic_link: true,
            magic_link_effective: true,
            magic_link_globally_enabled: true,
          });
        }
        return jsonResponse([
          {
            id: 7,
            name: 'Acme',
            slug: 'acme',
            owners: [4],
            access_mode: 'public',
            allowed_email_domains: [],
            desktop_redirect_schemes: ['shellui-playground'],
          },
        ]);
      }),
    );
    return render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <CompanyPage />
        </MemoryRouter>
      </I18nextProvider>,
    );
  }

  it('shows the setting to owners and staff', async () => {
    session.token = token({ is_company_owner: true });
    const owner = renderPage();
    expect(await screen.findByRole('heading', { name: /desktop sign-in schemes/i })).toBeTruthy();
    expect(screen.getByLabelText(/company name/i)).toBeTruthy();
    owner.unmount();

    session.token = token({ is_staff: true });
    renderPage();
    expect(await screen.findByRole('heading', { name: /desktop sign-in schemes/i })).toBeTruthy();
    expect(screen.queryByLabelText(/company name/i)).toBeNull();
  });

  it('hides company settings from members who are not owners or staff', () => {
    session.token = token({ is_company_owner: false, is_staff: false });
    renderPage();
    expect(screen.getByText(/you need to be a company owner/i)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /desktop sign-in schemes/i })).toBeNull();
  });
});
