import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { ActionsRuleEditorPage } from '@/features/actions/pages/ActionsRuleEditorPage';
import type { ActionRule } from '@/features/actions/types';

const rule: ActionRule = {
  id: 7,
  name: 'Deploy hook',
  event: 'identity.user.created',
  enabled: true,
  config: { url: 'https://hooks.example/shellui', has_secret: true, secret_hint: 'ab12' },
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-02T00:00:00Z',
};

const api = vi.hoisted(() => ({
  fetchEvents: vi.fn(),
  fetchRule: vi.fn(),
  updateRule: vi.fn(),
  sendRuleTest: vi.fn(),
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

function renderEditor() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/identity/webhooks/7']}>
        <ActionsRuleEditorPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('ActionsRuleEditorPage action feedback', () => {
  afterEach(async () => {
    cleanup();
    api.fetchEvents.mockReset();
    api.fetchRule.mockReset();
    api.updateRule.mockReset();
    api.sendRuleTest.mockReset();
    await i18n.changeLanguage('en');
  });

  it('shows save and test-event results under those buttons', async () => {
    api.fetchEvents.mockResolvedValue([{ key: 'identity.user.created', label: 'User created' }]);
    api.fetchRule.mockResolvedValue(rule);
    api.updateRule.mockRejectedValueOnce(new Error('Save refused.'));
    renderEditor();
    const save = await screen.findByRole('button', { name: 'Save rule' });
    fireEvent.click(save);
    const failure = await screen.findByText('Save refused.');
    expect(failure.className).toContain('text-destructive');
    expect(save.parentElement?.contains(failure)).toBe(true);
    expect(screen.getAllByText('Save refused.')).toHaveLength(1);

    fireEvent.change(screen.getByDisplayValue('Deploy hook'), {
      target: { value: 'Deploy hook 2' },
    });
    expect(screen.queryByText('Save refused.')).toBeNull();

    api.updateRule.mockResolvedValueOnce(rule);
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    const saved = await screen.findByText('Rule saved.');
    expect(saved.className).not.toContain('text-destructive');
    expect(screen.getByRole('button', { name: 'Save rule' }).parentElement?.contains(saved)).toBe(
      true,
    );

    api.sendRuleTest.mockRejectedValueOnce(new Error('Test refused.'));
    const send = screen.getByRole('button', { name: 'Send test event' });
    fireEvent.click(send);
    const testFailure = await screen.findByText('Test refused.');
    expect(send.parentElement?.contains(testFailure)).toBe(true);
    expect(screen.queryByText('Rule saved.')).toBeTruthy();
    expect(screen.getAllByText('Test refused.')).toHaveLength(1);
  });

  it('keeps a rule load failure at the top of the page', async () => {
    api.fetchEvents.mockResolvedValue([]);
    api.fetchRule.mockRejectedValueOnce({ status: 503 });
    renderEditor();
    expect(await screen.findByText('Could not load webhooks data.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save rule' })).toBeNull();
  });
});
