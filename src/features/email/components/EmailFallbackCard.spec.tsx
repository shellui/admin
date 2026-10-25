import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { EmailFallbackCard } from '@/features/email/components/EmailFallbackCard';
import { EmailApiError, emailErrorText } from '@/lib/emailApiErrors';
import { parseProvider } from '@/lib/emailApiParsers';
import type { EmailProviderSettings } from '@/lib/emailTypes';

const base: EmailProviderSettings = parseProvider({
  configured: false,
  fallback_provider: 'ses',
  fallback_configured: true,
  fallback_usage: {
    applies: true,
    disabled: false,
    day: '2026-10-25',
    used: 12,
    limit: 50,
    recipient_hourly_limit: 5,
  },
});

function show(settings: EmailProviderSettings) {
  return render(
    <I18nextProvider i18n={i18n}>
      <EmailFallbackCard settings={settings} />
    </I18nextProvider>,
  );
}

afterEach(cleanup);

describe('EmailFallbackCard', () => {
  it('parses fallback_usage', () => {
    expect(base.fallbackUsage).toEqual({
      applies: true,
      disabled: false,
      day: '2026-10-25',
      used: 12,
      limit: 50,
      recipientHourlyLimit: 5,
    });
    expect(parseProvider({}).fallbackUsage).toBeNull();
  });

  it('shows quota and progress', async () => {
    await i18n.changeLanguage('en');
    show(base);
    expect(screen.getByText('Using the Shellui default provider')).toBeTruthy();
    expect(screen.getByText('12 of 50 emails used today')).toBeTruthy();
    expect(screen.getByText('At most 5 emails per recipient per hour')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('12');
  });

  it('hides the bar when limit is 0', () => {
    show({ ...base, fallbackUsage: { ...base.fallbackUsage!, limit: 0 } });
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('12 emails sent today')).toBeTruthy();
  });

  it('warns when disabled or off', () => {
    show({ ...base, fallbackUsage: { ...base.fallbackUsage!, disabled: true } });
    expect(screen.getByText('No email provider')).toBeTruthy();
    cleanup();
    show({ ...base, fallbackProvider: 'none', fallbackConfigured: false });
    expect(screen.getByText('No email provider')).toBeTruthy();
  });

  it('renders nothing for configured or platform projects', () => {
    show({ ...base, configured: true });
    expect(screen.queryByTestId('email-fallback-card')).toBeNull();
    show({ ...base, fallbackUsage: { ...base.fallbackUsage!, applies: false } });
    expect(screen.queryByTestId('email-fallback-card')).toBeNull();
  });

  it('maps fallback error codes', () => {
    const t = i18n.t.bind(i18n) as never;
    for (const code of [
      'fallback_recipient_limit',
      'fallback_company_limit',
      'fallback_global_limit',
      'fallback_disabled',
    ]) {
      const text = emailErrorText(t, new EmailApiError(code, 429));
      expect(text).not.toBe(i18n.t('emailError_request_failed'));
    }
  });
});
