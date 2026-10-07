import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { ActionsDeliveryDetailPage } from '@/features/actions/pages/ActionsDeliveryDetailPage';
import type { ActionDeliveryDetail } from '@/features/actions/types';

const detail: ActionDeliveryDetail = {
  id: 'del-1',
  status: 'failed',
  event: 'identity.user.created',
  rule_id: 7,
  rule_name: 'Deploy hook',
  attempts_count: 1,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-02T00:00:00Z',
  last_error: 'timeout',
  attempts: [],
};

const api = vi.hoisted(() => ({
  fetchDelivery: vi.fn(),
  requeueDelivery: vi.fn(),
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

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/identity/webhooks/deliveries/del-1']}>
        <Routes>
          <Route
            path="/identity/webhooks/deliveries/:deliveryId"
            element={<ActionsDeliveryDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('ActionsDeliveryDetailPage action feedback', () => {
  afterEach(async () => {
    cleanup();
    api.fetchDelivery.mockReset();
    api.requeueDelivery.mockReset();
    await i18n.changeLanguage('en');
  });

  it('keeps a delivery load failure at the top of the page', async () => {
    api.fetchDelivery.mockRejectedValueOnce({ status: 503 });
    renderPage();
    expect(await screen.findByText('Could not load webhooks data.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Requeue delivery' })).toBeNull();
    expect(screen.queryByText('Delivery queued again.')).toBeNull();
  });

  it('shows requeue success and failure under Requeue delivery', async () => {
    api.fetchDelivery.mockResolvedValue(detail);
    api.requeueDelivery.mockRejectedValueOnce(new Error('Requeue refused.'));
    renderPage();
    const requeue = await screen.findByRole('button', { name: 'Requeue delivery' });
    fireEvent.click(requeue);
    const failure = await screen.findByText('Requeue refused.');
    expect(failure.className).toContain('text-destructive');
    expect(requeue.parentElement?.contains(failure)).toBe(true);
    expect(screen.getAllByText('Requeue refused.')).toHaveLength(1);
    expect(screen.queryByText('Could not load webhooks data.')).toBeNull();

    api.requeueDelivery.mockResolvedValueOnce(undefined);
    api.fetchDelivery.mockResolvedValueOnce({ ...detail, status: 'pending' });
    fireEvent.click(screen.getByRole('button', { name: 'Requeue delivery' }));
    const sent = await screen.findByText('Delivery queued again.');
    expect(sent.className).not.toContain('text-destructive');
    expect(
      screen.getByRole('button', { name: 'Requeue delivery' }).parentElement?.contains(sent),
    ).toBe(true);
    expect(screen.queryByText('Requeue refused.')).toBeNull();
  });
});
