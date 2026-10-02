import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { EmailProviderForm } from '@/features/email/components/EmailProviderForm';
import type { EmailProviderSettings, EmailProviderWrite } from '@/lib/emailTypes';

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
};

function renderForm(onSave = vi.fn(async (_body: EmailProviderWrite) => undefined)) {
  render(
    <I18nextProvider i18n={i18n}>
      <EmailProviderForm
        settings={settings}
        jwtEmail="ada@acme.com"
        isStaff={false}
        saving={false}
        testing={false}
        onSave={onSave}
        onTest={vi.fn(async () => undefined)}
      />
    </I18nextProvider>,
  );
  return onSave;
}

describe('EmailProviderForm', () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  it('shows the masked hint and never puts the key in the field', async () => {
    const onSave = renderForm();
    const input = screen.getByLabelText('API key') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.value).not.toContain('abcd');
    expect(input.placeholder).not.toContain('abcd');
    expect(screen.getByText(/••••abcd/)).toBeTruthy();

    fireEvent.change(input, { target: { value: 're_company_key' } });
    expect(input.value).toBe('re_company_key');

    fireEvent.click(screen.getByRole('button', { name: 'Save provider' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const body = onSave.mock.calls[0]?.[0];
    expect(body?.credentials).toEqual({ api_key: 're_company_key' });
    expect((screen.getByLabelText('API key') as HTMLInputElement).value).toBe('');
    expect(screen.getByLabelText('API key').getAttribute('value')).not.toBe('re_company_key');
  });

  it('omits credentials when the key is left blank and the provider is unchanged', async () => {
    const onSave = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save provider' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('credentials');
    expect(JSON.stringify(onSave.mock.calls[0]?.[0])).not.toContain('api_key');
  });

  it('disables SMTP unless the provider payload says company SMTP is allowed', () => {
    renderForm();
    const smtp = screen.getByRole('option', { name: /SMTP/ }) as HTMLOptionElement;
    expect(smtp.disabled).toBe(true);
    cleanup();
    render(
      <I18nextProvider i18n={i18n}>
        <EmailProviderForm
          settings={{ ...settings, smtpAllowed: true }}
          jwtEmail="ada@acme.com"
          isStaff={false}
          saving={false}
          testing={false}
          onSave={vi.fn(async () => undefined)}
          onTest={vi.fn(async () => undefined)}
        />
      </I18nextProvider>,
    );
    expect((screen.getByRole('option', { name: 'SMTP' }) as HTMLOptionElement).disabled).toBe(
      false,
    );
  });

  it('does not redisplay a key after the parent passes a new hint', () => {
    const { rerender } = render(
      <I18nextProvider i18n={i18n}>
        <EmailProviderForm
          settings={settings}
          jwtEmail="ada@acme.com"
          isStaff
          saving={false}
          testing={false}
          onSave={vi.fn(async () => undefined)}
          onTest={vi.fn(async () => undefined)}
        />
      </I18nextProvider>,
    );
    const input = screen.getByLabelText('API key') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 're_typed' } });
    rerender(
      <I18nextProvider i18n={i18n}>
        <EmailProviderForm
          settings={{ ...settings, credentialsHint: '••••typed' }}
          jwtEmail="ada@acme.com"
          isStaff
          saving={false}
          testing={false}
          onSave={vi.fn(async () => undefined)}
          onTest={vi.fn(async () => undefined)}
        />
      </I18nextProvider>,
    );
    const next = screen.getByLabelText('API key') as HTMLInputElement;
    expect(next.value).toBe('re_typed');
    expect(next.value).not.toContain('••••');
  });
});
