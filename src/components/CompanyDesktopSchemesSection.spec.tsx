import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { CompanyDesktopSchemesSection } from '@/components/CompanyDesktopSchemesSection';
import { IDENTITY_DESKTOP_APPS_DOCS_URL } from '@/lib/desktopRedirectScheme';

function sessionToken(): string {
  const body = btoa(JSON.stringify({ company_id: 7 }))
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

const company = {
  id: 7,
  name: 'Acme',
  slug: 'acme',
  owners: [4],
  access_mode: 'public',
  allowed_email_domains: [],
  desktop_redirect_schemes: ['shellui-playground'],
};

function renderSection() {
  return render(
    <I18nextProvider i18n={i18n}>
      <CompanyDesktopSchemesSection accessToken={sessionToken()} />
    </I18nextProvider>,
  );
}

describe('CompanyDesktopSchemesSection', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the deep link, docs, and a per-entry validation error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([company])),
    );
    renderSection();

    expect(await screen.findByText('shellui-playground://callback')).toBeTruthy();
    const docs = screen.getByRole('link', { name: 'Desktop apps' });
    expect(docs.getAttribute('href')).toBe(IDENTITY_DESKTOP_APPS_DOCS_URL);

    fireEvent.change(screen.getByLabelText(/desktop sign-in schemes 1/i), {
      target: { value: 'https' },
    });
    expect(screen.getByText('This scheme is not allowed.')).toBeTruthy();
    expect(screen.getByText('<scheme>://callback')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^save$/i }).hasAttribute('disabled')).toBe(true);
  });

  it('saves the list and sends an empty list to turn desktop sign-in off', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as { desktop_redirect_schemes: string[] };
        return jsonResponse({
          ...company,
          desktop_redirect_schemes: body.desktop_redirect_schemes,
        });
      }
      return jsonResponse([company]);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderSection();

    await screen.findByDisplayValue('shellui-playground');
    fireEvent.click(screen.getByRole('button', { name: /remove scheme/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find((call) => call[1]?.method === 'PATCH');
      expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ desktop_redirect_schemes: [] });
    });
    expect(screen.getByText('<scheme>://callback')).toBeTruthy();
  });

  it('shows a server field error on the field', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return jsonResponse({ desktop_redirect_schemes: ['Scheme must be lowercase.'] }, 400);
      }
      return jsonResponse([{ ...company, desktop_redirect_schemes: [] }]);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderSection();

    expect(await screen.findByText('<scheme>://callback')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /add scheme/i }));
    fireEvent.change(screen.getByLabelText(/desktop sign-in schemes 1/i), {
      target: { value: 'shellui-playground' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByText('Scheme must be lowercase.')).toBeTruthy();
  });
});
