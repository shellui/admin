import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { DashboardEmailSection } from '@/components/DashboardEmailSection';
import { EmailApiError } from '@/lib/emailApiErrors';
import type { EmailProviderSettings, EmailStats } from '@/lib/emailTypes';

const state = vi.hoisted(() => {
  const api = {
    fetchStats: vi.fn(),
    fetchProvider: vi.fn(),
  };
  return { enabled: true, api };
});

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'token',
}));

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailAdminEnabled: () => state.enabled,
  useEmailApi: () => ({
    api: state.api,
    companyId: 42,
    baseUrl: 'https://email.shellui.com',
    canManage: true,
  }),
  useEmailBaseUrl: () => 'https://email.shellui.com',
}));

const stats: EmailStats = {
  companyId: 42,
  from: '2026-09-02T00:00:00Z',
  to: '2026-10-02T00:00:00Z',
  totals: {
    sent: 8,
    delivered: 6,
    bounced: 1,
    complained: 2,
    expired: 0,
    failed: 4,
    queued: 0,
    suppressed: 3,
    cancelled: 0,
  },
  skipped: { total: 0, noRecipients: 0, ruleDisabled: 0 },
  byLane: {},
  byEvent: {},
  byDay: [],
};

const configured: EmailProviderSettings = {
  companyId: 42,
  configured: true,
  provider: 'resend',
  fromEmail: 'no-reply@acme.com',
  fromName: 'Acme',
  sendingDomain: 'acme.com',
  bulkFromEmail: '',
  credentialsHint: '',
  webhookConfigured: false,
  webhookHint: '',
  fallbackProvider: 'resend',
  fallbackConfigured: true,
  smtpAllowed: false,
  authLinkHosts: ['id.shellui.com'],
};

function renderSection() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <DashboardEmailSection />
        <p>Identity still here</p>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('DashboardEmailSection', () => {
  afterEach(async () => {
    cleanup();
    state.enabled = true;
    state.api.fetchStats.mockReset();
    state.api.fetchProvider.mockReset();
    await i18n.changeLanguage('en');
  });

  it('shows delivery counts and a link to Email', async () => {
    state.api.fetchStats.mockResolvedValue(stats);
    state.api.fetchProvider.mockResolvedValue(configured);
    renderSection();
    expect(await screen.findByText('8')).toBeTruthy();
    expect(screen.getByText('Sent')).toBeTruthy();
    expect(screen.getByText('Delivered')).toBeTruthy();
    expect(screen.getByText('Bounced')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('Complaints')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Suppressed')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Open Email' });
    expect(link.getAttribute('href')).toBe('/email/statistics');
    expect(screen.getByText('Identity still here')).toBeTruthy();
  });

  it('hides the block when Email is hidden in Admin', async () => {
    state.enabled = false;
    renderSection();
    await waitFor(() => expect(state.api.fetchStats).not.toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Email' })).toBeNull();
    expect(screen.getByText('Identity still here')).toBeTruthy();
  });

  it('shows a quiet empty state when email-service is unreachable', async () => {
    state.api.fetchStats.mockRejectedValue(new TypeError('Failed to fetch'));
    state.api.fetchProvider.mockRejectedValue(new TypeError('Failed to fetch'));
    renderSection();
    const note = await screen.findByText('Email statistics are unavailable.');
    expect(note.className).not.toContain('text-destructive');
    expect(screen.queryByText('Failed to fetch')).toBeNull();
    expect(screen.queryByText('Sent')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open Email' })).toBeTruthy();
    expect(screen.getByText('Identity still here')).toBeTruthy();
  });

  it('shows a quiet empty state when no company provider is configured', async () => {
    state.api.fetchStats.mockResolvedValue(stats);
    state.api.fetchProvider.mockResolvedValue({ ...configured, configured: false, provider: null });
    renderSection();
    const note = await screen.findByText('No company email provider is configured.');
    expect(note.className).not.toContain('text-destructive');
    expect(screen.queryByText('8')).toBeNull();
    expect(screen.getByText('Identity still here')).toBeTruthy();

    await i18n.changeLanguage('fr');
    expect(
      await screen.findByText('Aucun fournisseur d’e-mail d’entreprise n’est configuré.'),
    ).toBeTruthy();
  });

  it('maps provider_not_configured without showing API prose', async () => {
    state.api.fetchStats.mockRejectedValue(new EmailApiError('provider_not_configured', 409));
    state.api.fetchProvider.mockRejectedValue(new EmailApiError('provider_not_configured', 409));
    renderSection();
    expect(await screen.findByText('No company email provider is configured.')).toBeTruthy();
    expect(screen.queryByText(/Please configure/)).toBeNull();
    expect(screen.queryByText('provider_not_configured')).toBeNull();
  });
});
