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

function renderSection(canEdit = true) {
  return render(
    <I18nextProvider i18n={i18n}>
      <CompanyDesktopSchemesSection
        accessToken={sessionToken()}
        canEdit={canEdit}
      />
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
    const devScheme = screen.getByRole('switch', { name: /allow dev builds/i });
    expect(devScheme.hasAttribute('disabled')).toBe(true);
    expect(devScheme.getAttribute('aria-readonly')).toBeNull();
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
    expect(screen.getByRole('switch', { name: /allow dev builds/i }).hasAttribute('disabled')).toBe(
      false,
    );
    fireEvent.click(screen.getByRole('button', { name: /remove scheme/i }));
    expect(screen.getByRole('switch', { name: /allow dev builds/i }).hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find((call) => call[1]?.method === 'PATCH');
      expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
        desktop_redirect_schemes: [],
        allow_desktop_dev_scheme: false,
      });
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

  it('saves the dev-scheme flag with the scheme list', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as {
          desktop_redirect_schemes: string[];
          allow_desktop_dev_scheme: boolean;
        };
        return jsonResponse({ ...company, ...body });
      }
      return jsonResponse([{ ...company, allow_desktop_dev_scheme: false }]);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderSection();

    const devScheme = await screen.findByRole('switch', { name: /allow dev builds/i });
    expect(devScheme.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/dev builds of your listed apps can sign in/i)).toBeTruthy();
    fireEvent.click(devScheme);
    expect(devScheme.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find((call) => call[1]?.method === 'PATCH');
      expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
        desktop_redirect_schemes: ['shellui-playground'],
        allow_desktop_dev_scheme: true,
      });
    });
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(i18n.getFixedT('fr')('companyDesktopDevSchemeLabel')).toBe(
      'Autoriser les builds de dev (schémas -dev)',
    );
    expect(i18n.getFixedT('fr')('companyDesktopDevSchemeHelp')).toBe(
      'Les builds de dev de vos applications listées peuvent se connecter à cette entreprise. Désactivez l’option une fois le débogage terminé.',
    );
  });

  it('shows a 403 from the dev-scheme save with the company error text', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return jsonResponse({ error: 'Forbidden' }, 403);
      }
      return jsonResponse([company]);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderSection();

    fireEvent.click(await screen.findByRole('switch', { name: /allow dev builds/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText('Forbidden')).toBeTruthy();
  });

  it('keeps the dev-scheme switch read-only when the viewer cannot edit', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse([{ ...company, allow_desktop_dev_scheme: true }]),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderSection(false);

    const devScheme = await screen.findByRole('switch', { name: /allow dev builds/i });
    expect(devScheme.getAttribute('aria-checked')).toBe('true');
    expect(devScheme.hasAttribute('disabled')).toBe(true);
    expect(devScheme.getAttribute('aria-readonly')).toBe('true');
    fireEvent.click(devScheme);
    expect(devScheme.getAttribute('aria-checked')).toBe('true');
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'PATCH')).toBe(false);
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
    expect((screen.getByLabelText(/desktop sign-in schemes 1/i) as HTMLInputElement).disabled).toBe(
      true,
    );
  });
});
