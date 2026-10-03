import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({ api: null, canManage: false, baseUrl: '' }),
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
    await i18n.changeLanguage('en');
  });

  it('keeps a rules load failure at the top of the page', async () => {
    api.fetchRules.mockRejectedValueOnce({ status: 503 });
    renderPage();
    expect(await screen.findByText('Could not load webhooks data.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Disable' })).toBeNull();
    expect(screen.queryByText('Webhook disabled.')).toBeNull();
  });

  it('shows enable and disable results on that rule row', async () => {
    api.fetchRules.mockResolvedValueOnce([rule]);
    api.updateRule.mockRejectedValueOnce(new Error('Webhook refused.'));
    renderPage();
    const disable = await screen.findByRole('button', { name: 'Disable' });
    fireEvent.click(disable);
    const failure = await screen.findByText('Webhook refused.');
    expect(failure.className).toContain('text-destructive');
    expect(disable.closest('tr')?.contains(failure)).toBe(true);
    expect(screen.getAllByText('Webhook refused.')).toHaveLength(1);

    api.updateRule.mockResolvedValueOnce({ ...rule, enabled: false });
    api.fetchRules.mockResolvedValueOnce([{ ...rule, enabled: false }]);
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    const sent = await screen.findByText('Webhook disabled.');
    expect(sent.className).not.toContain('text-destructive');
    expect(screen.getByRole('button', { name: 'Enable' }).closest('tr')?.contains(sent)).toBe(true);
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
    expect(remove.closest('tr')?.contains(failure)).toBe(true);
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
});
