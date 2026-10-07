import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { EmailProviderPage } from '@/features/email/pages/EmailProviderPage';
import { EmailApiError } from '@/lib/emailApiErrors';
import type { EmailProviderSettings } from '@/lib/emailTypes';

const settings: EmailProviderSettings = {
  companyId: 42,
  configured: true,
  provider: 'resend',
  fromEmail: 'no-reply@acme.com',
  fromName: 'Acme',
  sendingDomain: 'acme.com',
  bulkFromEmail: '',
  credentialsHint: '••••abcd',
  webhookConfigured: false,
  webhookHint: '',
  fallbackProvider: 'resend',
  fallbackConfigured: true,
  smtpAllowed: false,
  authLinkHosts: [],
};

const api = vi.hoisted(() => ({
  fetchProvider: vi.fn(),
  saveProvider: vi.fn(),
  testProvider: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () =>
    `e.${btoa(JSON.stringify({ email: 'ada@acme.com', company_id: 42, user_metadata: { is_staff: false, is_company_owner: true } }))}.s`,
}));

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({
    api,
    companyId: 42,
    baseUrl: 'https://email.shellui.com',
    canManage: true,
  }),
}));

describe('EmailProviderPage', () => {
  afterEach(async () => {
    cleanup();
    api.fetchProvider.mockReset();
    api.saveProvider.mockReset();
    api.testProvider.mockReset();
    await i18n.changeLanguage('en');
  });

  it('keeps a test-send failure next to the button', async () => {
    api.fetchProvider.mockResolvedValue(settings);
    api.testProvider.mockRejectedValue(new EmailApiError('provider_test_failed', 502));
    render(
      <I18nextProvider i18n={i18n}>
        <EmailProviderPage />
      </I18nextProvider>,
    );
    const send = await screen.findByRole('button', { name: 'Send test email' });
    fireEvent.click(send);
    const messages = await screen.findAllByText('The provider refused the test email.');
    expect(messages).toHaveLength(1);
    expect(send.parentElement?.parentElement?.contains(messages[0])).toBe(true);
  });

  it('keeps a load failure at the top and does not open the form', async () => {
    api.fetchProvider.mockRejectedValue(new EmailApiError('request_failed', 503));
    render(
      <I18nextProvider i18n={i18n}>
        <EmailProviderPage />
      </I18nextProvider>,
    );
    expect(await screen.findByText('The email request failed.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send test email' })).toBeNull();
  });

  it('keeps a save failure next to Save provider', async () => {
    api.fetchProvider.mockResolvedValue(settings);
    api.saveProvider.mockRejectedValue(new EmailApiError('provider_host_not_public', 400));
    render(
      <I18nextProvider i18n={i18n}>
        <EmailProviderPage />
      </I18nextProvider>,
    );
    const save = await screen.findByRole('button', { name: 'Save provider' });
    fireEvent.click(save);
    const messages = await screen.findAllByText('The SMTP host must resolve to a public address.');
    expect(messages).toHaveLength(1);
    expect(save.parentElement?.contains(messages[0])).toBe(true);
  });
});
