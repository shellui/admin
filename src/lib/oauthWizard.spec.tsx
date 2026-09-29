import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { OAuthCallbackUrlCopy } from '@/components/oauth/OAuthCallbackUrlCopy';
import { OAuthConsoleUrlList } from '@/components/oauth/OAuthConsoleUrlList';
import { OAuthCredentialsForm } from '@/components/oauth/OAuthCredentialsForm';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { OAuthProviderPicker } from '@/components/oauth/OAuthProviderPicker';
import { visibleCatalogProviders } from '@/lib/oauthCatalogDisplay';

vi.mock('@/lib/loadOAuthIcon', () => ({
  hasBundledOAuthIcon: () => false,
  loadOAuthIconSvg: vi.fn(),
  OAUTH_ICON_META: {},
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

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
        <MemoryRouter>
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
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect(screen.getByDisplayValue('acme')).toBeTruthy();
    expect(screen.getByText('Organization')).toBeTruthy();
    const secret = screen.getByPlaceholderText(/leave empty to keep current secret/i);
    expect(secret.getAttribute('type')).toBe('password');
  });

  it('shows translated console links instead of raw catalog labels', () => {
    const linkedin: OAuthCatalogProvider = {
      ...github,
      docs_slug: 'linkedin',
      name: 'LinkedIn',
      console_url: [
        {
          kind: 'app_registration',
          url: 'https://www.linkedin.com/secure/developer?newapp=',
          form: 'link',
          label: 'App registration (get your key and secret here)',
        },
      ],
    };

    render(
      <I18nextProvider i18n={i18n}>
        <OAuthConsoleUrlList provider={linkedin} />
      </I18nextProvider>,
    );

    const link = screen.getByRole('link', { name: /create an app on linkedin/i });
    expect(link.getAttribute('href')).toBe('https://www.linkedin.com/secure/developer?newapp=');
    expect(screen.queryByText(/get your key and secret/i)).toBeNull();
  });

  it('omits unsupported and legacy providers from the visible catalog', () => {
    const filtered = visibleCatalogProviders([
      github,
      { ...github, docs_slug: 'legacy', legacy: true },
      {
        ...github,
        docs_slug: 'disabled',
        name: 'Disabled',
        supported: false,
      },
    ]);
    expect(filtered.map((p) => p.docs_slug)).toEqual(['github']);
  });

  it('shows section count in picker when more than five tiles in a section', () => {
    const others = Array.from({ length: 6 }, (_, i) => ({
      ...github,
      docs_slug: `provider-${i}`,
      name: `Provider ${i}`,
      tier: 'other' as const,
    }));
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <OAuthProviderPicker
            providers={others}
            socialApps={[]}
            onAdd={() => {}}
            onOpenApp={() => {}}
          />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading', { name: /more providers \(6\)/i })).toBeTruthy();
  });

  it('hides section count in picker when five or fewer tiles', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <OAuthProviderPicker
            providers={[github, { ...github, docs_slug: 'google', name: 'Google' }]}
            socialApps={[]}
            onAdd={() => {}}
            onOpenApp={() => {}}
          />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading', { name: /^popular providers$/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /popular providers \(\d+\)/i })).toBeNull();
  });

  it('filters picker tiles with global search', () => {
    const onAdd = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <OAuthProviderPicker
            providers={[github, { ...github, docs_slug: 'google', name: 'Google' }]}
            socialApps={[]}
            onAdd={onAdd}
            onOpenApp={() => {}}
          />
        </MemoryRouter>
      </I18nextProvider>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /search providers/i }), {
      target: { value: 'git' },
    });
    expect(screen.getByRole('button', { name: /add github/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /add google/i })).toBeNull();
  });

  it('opens settings for a configured named provider instead of adding again', () => {
    const onOpenApp = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <OAuthProviderPicker
            providers={[github]}
            socialApps={[
              {
                id: 99,
                provider: 'github',
                name: 'GitHub',
                client_id: 'cid',
                is_linked: true,
                mapping_id: null,
                mapping_is_active: false,
              },
            ]}
            onAdd={vi.fn()}
            onOpenApp={onOpenApp}
          />
        </MemoryRouter>
      </I18nextProvider>,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /github is already set up/i,
      }),
    );
    expect(onOpenApp).toHaveBeenCalledWith(99);
  });

  it('shows a count for configured generic providers and still allows add', () => {
    const onAdd = vi.fn();
    const oidc = {
      ...github,
      docs_slug: 'openid_connect',
      name: 'OpenID Connect',
      tier: 'generic' as const,
      protocol: 'OIDC',
      multiple_allowed: true,
    };
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <OAuthProviderPicker
            providers={[oidc]}
            socialApps={[
              {
                id: 1,
                provider: 'openid_connect',
                name: 'OIDC 1',
                client_id: 'a',
                is_linked: true,
                mapping_id: null,
                mapping_is_active: false,
              },
              {
                id: 2,
                provider: 'openid_connect',
                name: 'OIDC 2',
                client_id: 'b',
                is_linked: true,
                mapping_id: null,
                mapping_is_active: false,
              },
            ]}
            onAdd={onAdd}
            onOpenApp={() => {}}
          />
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect(screen.getByText(/configured \(2\)/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^add another$/i }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ docs_slug: 'openid_connect' }));
  });
});
