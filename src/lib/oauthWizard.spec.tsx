import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { OAuthCallbackUrlCopy } from '@/components/oauth/OAuthCallbackUrlCopy';
import { OAuthCredentialsForm } from '@/components/oauth/OAuthCredentialsForm';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { OAuthProviderPicker } from '@/components/oauth/OAuthProviderPicker';

const github: OAuthCatalogProvider = {
  docs_slug: 'github',
  name: 'GitHub',
  tier: 'popular',
  legacy: false,
  replaced_by: null,
  protocol: 'OAuth2',
  supported: true,
  unsupported_reason: null,
  icon: { source: 'simple-icons', slug: 'github', hex: '181717', title: 'GitHub' },
  docs_url: 'https://docs.allauth.org/en/latest/socialaccount/providers/github.html',
  console_url: [],
  callback_url: 'https://identity.test/api/v1/oauth/callback',
  extra_settings_schema: [
    {
      name: 'ORG',
      label: 'Organization',
      type: 'string',
      required: false,
      secret: false,
      help_text: 'Optional GitHub org slug.',
    },
  ],
};

describe('OAuth wizard UI', () => {
  it('copies callback URL to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <I18nextProvider i18n={i18n}>
        <OAuthCallbackUrlCopy callbackUrl="https://identity.test/api/v1/oauth/callback" />
      </I18nextProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://identity.test/api/v1/oauth/callback');
    });
    expect(screen.getByRole('button', { name: /copied/i })).toBeTruthy();
  });

  it('renders dynamic extra_settings fields and masks secrets on edit', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <OAuthCredentialsForm
          provider={github}
          mode="edit"
          values={{
            client_id: 'id',
            client_secret: '',
            tenant: '',
            extra_settings: { ORG: 'acme' },
          }}
          onChange={() => {}}
          onSubmit={() => {}}
        />
      </I18nextProvider>,
    );

    expect(screen.getByDisplayValue('acme')).toBeTruthy();
    const secret = screen.getByPlaceholderText(/leave empty to keep current secret/i);
    expect(secret.getAttribute('type')).toBe('password');
  });

  it('disables unsupported providers in the picker', () => {
    const onSelect = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <OAuthProviderPicker
            providers={[
              github,
              {
                ...github,
                docs_slug: 'disabled',
                name: 'Disabled',
                supported: false,
                unsupported_reason: 'Requires extra deployment config.',
              },
            ]}
            socialApps={[]}
            includeLegacy={false}
            onIncludeLegacyChange={() => {}}
            onSelect={onSelect}
          />
        </MemoryRouter>
      </I18nextProvider>,
    );

    const disabled = screen.getByRole('button', { name: /disabled/i });
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(disabled);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
