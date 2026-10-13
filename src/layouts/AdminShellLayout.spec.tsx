import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import shellui from '@shellui/sdk';
import i18n from '@/i18n';
import { appVersionLabel } from '@/lib/appVersion';
import { AdminShellLayout } from '@/layouts/AdminShellLayout';

const hooks = vi.hoisted(() => ({
  isStaff: true,
  developerMode: false,
  email: { url: 'http://localhost:8003/', showInAdmin: true as boolean | undefined },
}));

vi.mock('@/hooks/useShelluiIsStaff', () => ({
  useShelluiIsStaff: () => hooks.isStaff,
}));

vi.mock('@/hooks/useShelluiEmail', () => ({
  useShelluiEmail: () => hooks.email,
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/useShelluiDeveloperMode', () => ({
  useShelluiDeveloperMode: () => hooks.developerMode,
}));

function sectionHrefs(title: RegExp): string[] {
  const header = screen.getByRole('button', { name: title });
  const group = header.parentElement;
  if (!group) return [];
  return [...group.querySelectorAll('a')].map((link) => link.getAttribute('href') ?? '');
}

function renderShell() {
  shellui.addMessageListener = () => () => {};
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/']}>
        <AdminShellLayout />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('service Django admin links', () => {
  afterEach(async () => {
    cleanup();
    hooks.isStaff = true;
    hooks.developerMode = false;
    hooks.email = { url: 'http://localhost:8003/', showInAdmin: true };
    await i18n.changeLanguage('en');
  });

  it('shows staff Django admin for Email and puts Identity statistics before it', () => {
    renderShell();

    const identityHrefs = sectionHrefs(/^Identity/);
    expect(identityHrefs.at(-2)).toBe('/identity/statistics');
    expect(identityHrefs.at(-1)).toBe('http://localhost:8000/admin/');

    const emailHrefs = sectionHrefs(/^Email/);
    expect(emailHrefs.at(-2)).toBe('/email/statistics');
    expect(emailHrefs.at(-1)).toBe('http://localhost:8003/admin/');

    const emailHeader = screen.getByRole('button', { name: /^Email/ });
    const emailAdmin = emailHeader.parentElement?.querySelector('a[target="_blank"]');
    expect(emailAdmin?.getAttribute('href')).toBe('http://localhost:8003/admin/');
    expect(emailAdmin?.getAttribute('rel')).toContain('noopener');
  });

  it('keeps developer docs between Identity statistics and Django admin', () => {
    hooks.developerMode = true;
    renderShell();
    expect(sectionHrefs(/^Identity/).slice(-4)).toEqual([
      '/identity/statistics',
      '/swagger',
      '/redoc',
      'http://localhost:8000/admin/',
    ]);
  });

  it('hides Django admin links from company owners', () => {
    hooks.isStaff = false;
    renderShell();
    expect(screen.queryByRole('link', { name: /Django admin/ })).toBeNull();
    expect(sectionHrefs(/^Identity/).at(-1)).toBe('/identity/statistics');
    expect(sectionHrefs(/^Email/).at(-1)).toBe('/email/statistics');
  });

  it('hides Email Django admin when the Email section is off', () => {
    hooks.email = { url: 'http://localhost:8003', showInAdmin: false };
    renderShell();
    expect(screen.queryByRole('button', { name: /^Email/ })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Django admin/ })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Django admin/ }).getAttribute('href')).toBe(
      'http://localhost:8000/admin/',
    );
  });
});

describe('sidebar version', () => {
  afterEach(() => {
    cleanup();
  });

  it('pins the package version at the bottom of the sidebar', () => {
    renderShell();
    const version = screen.getByText(appVersionLabel);
    const aside = version.closest('aside');
    expect(aside?.lastElementChild).toBe(version);
    expect(version.className).toContain('text-center');
    expect(version.className).toContain('text-xs');
    expect(version.className).toContain('text-muted-foreground');
    expect(appVersionLabel).toMatch(/^v\d+\.\d+\.\d+/);
  });
});
