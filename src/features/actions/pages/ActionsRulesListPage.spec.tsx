import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { ActionsRulesListPage } from '@/features/actions/pages/ActionsRulesListPage';
import type { ActionRule } from '@/features/actions/types';

const rule: ActionRule = {
  id: 7,
  name: 'Deploy hook',
  event: 'hosting.deployment.failed',
  enabled: true,
  config: { url: 'https://hooks.example/shellui' },
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-02T00:00:00Z',
};

const api = vi.hoisted(() => ({
  fetchRules: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'token',
}));

vi.mock('@/lib/jwtCompany', () => ({
  getIsCompanyOwnerFromJwt: () => true,
}));

vi.mock('@/features/actions/useWebhookPageMeta', () => ({
  useWebhookPageMeta: () => ({
    service: {
      key: 'identity',
      labelKey: 'webhooksServiceIdentity',
      badgeKey: 'webhooksBadgeIdentity',
      pageTitleKey: 'webhooksPageTitleIdentity',
      deliveriesPageTitleKey: 'webhooksDeliveriesPageTitleIdentity',
      descriptionKey: 'webhooksPageDescriptionIdentity',
      eventScopeKey: 'webhooksEventScopeIdentity',
      baseUrl: 'https://id.example',
    },
    serviceConfigured: true,
  }),
}));

vi.mock('@/features/actions/useActionsApi', () => ({
  useActionsApi: () => ({ api, companyId: 1, serviceConfigured: true }),
}));

const emailState = vi.hoisted(() => ({
  api: null as null | {
    fetchRules: ReturnType<typeof vi.fn>;
    fetchTemplates: ReturnType<typeof vi.fn>;
    patchRule: ReturnType<typeof vi.fn>;
    deleteRule: ReturnType<typeof vi.fn>;
  },
  canManage: false,
}));

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({ api: emailState.api, canManage: emailState.canManage, baseUrl: '' }),
}));

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <ActionsRulesListPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('ActionsRulesListPage action feedback', () => {
  afterEach(async () => {
    cleanup();
    api.fetchRules.mockReset();
    api.updateRule.mockReset();
    api.deleteRule.mockReset();
    emailState.api = null;
    emailState.canManage = false;
    await i18n.changeLanguage('en');
  });

  it('keeps a rules load failure at the top of the page', async () => {
    api.fetchRules.mockRejectedValueOnce({ status: 503 });
    renderPage();
    expect(await screen.findByText('Could not load webhooks data.')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText('Webhook disabled.')).toBeNull();
  });

  it('shows enable and disable results on that rule row', async () => {
    api.fetchRules.mockResolvedValueOnce([rule]);
    api.updateRule.mockRejectedValueOnce(new Error('Webhook refused.'));
    renderPage();
    const toggle = await screen.findByRole('switch', { name: 'Deploy hook' });
    fireEvent.click(toggle);
    const failure = await screen.findByText('Webhook refused.');
    expect(failure.className).toContain('text-destructive');
    expect(toggle.closest('li')?.contains(failure)).toBe(true);
    expect(screen.getAllByText('Webhook refused.')).toHaveLength(1);

    api.updateRule.mockResolvedValueOnce({ ...rule, enabled: false });
    api.fetchRules.mockResolvedValueOnce([{ ...rule, enabled: false }]);
    fireEvent.click(screen.getByRole('switch', { name: 'Deploy hook' }));
    const sent = await screen.findByText('Webhook disabled.');
    expect(sent.className).not.toContain('text-destructive');
    expect(screen.getByRole('switch', { name: 'Deploy hook' }).closest('li')?.contains(sent)).toBe(
      true,
    );
    expect(screen.queryByText('Webhook refused.')).toBeNull();
  });

  it('shows a delete failure on the row and a delete success where the rule was', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.fetchRules.mockResolvedValue([rule]);
    api.deleteRule.mockRejectedValueOnce(new Error('Delete refused.'));
    renderPage();
    const remove = await screen.findByRole('button', { name: 'Delete' });
    fireEvent.click(remove);
    const failure = await screen.findByText('Delete refused.');
    expect(remove.closest('li')?.contains(failure)).toBe(true);
    expect(screen.getAllByText('Delete refused.')).toHaveLength(1);

    api.deleteRule.mockResolvedValueOnce(undefined);
    api.fetchRules.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const sent = await screen.findByText('Webhook deleted.');
    expect(sent.className).not.toContain('text-destructive');
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByText('Delete refused.')).toBeNull();
    vi.mocked(window.confirm).mockRestore();
  });

  it('locks a built-in email rule on and omits delete', async () => {
    api.fetchRules.mockResolvedValue([]);
    emailState.canManage = true;
    emailState.api = {
      fetchRules: vi.fn().mockResolvedValue([
        {
          id: 3,
          service: 'identity',
          eventType: 'identity.auth.magic_link.requested',
          enabled: true,
          recipientMode: 'hints',
          staticRecipients: [],
          language: '',
          templateId: 15,
          builtIn: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]),
      fetchTemplates: vi.fn().mockResolvedValue([
        {
          id: 15,
          name: 'Magic link',
          eventType: 'identity.auth.magic_link.requested',
          language: 'en',
          templateKey: 'identity.auth.magic_link.requested',
          companyId: 1,
          activeVersion: 1,
          theme: 'barebone',
          usesCompanyTheme: true,
        },
      ]),
      patchRule: vi.fn(),
      deleteRule: vi.fn(),
    };
    renderPage();
    const badge = await screen.findByText('Built in');
    expect(badge.getAttribute('title')).toBe('Built-in rules stay on.');
    const row = badge.closest('li');
    expect(row ? within(row).queryByRole('switch') : null).toBeNull();
    expect(row ? within(row).queryByRole('button', { name: 'Delete' }) : null).toBeNull();
    expect(emailState.api.patchRule).not.toHaveBeenCalled();
  });

  it('updates the rule count with the search query', async () => {
    api.fetchRules.mockResolvedValue(
      Array.from({ length: 6 }, (_, index) => ({
        ...rule,
        id: index + 1,
        name: index === 0 ? 'alpha hook' : `hook ${index}`,
        event: `event.${index}`,
        created_at: `2026-01-0${index + 1}T00:00:00Z`,
      })),
    );
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Rules (6)' })).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search rules' }), {
      target: { value: 'alpha' },
    });
    expect(screen.getByRole('heading', { name: 'Rules' })).toBeTruthy();
    expect(screen.getByText('event.0')).toBeTruthy();
    expect(screen.queryByText('event.1')).toBeNull();
  });
});
