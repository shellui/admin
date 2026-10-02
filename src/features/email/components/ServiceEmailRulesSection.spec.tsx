import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { ServiceEmailRulesSection } from '@/features/email/components/ServiceEmailRulesSection';
import type { EmailApiClient } from '@/lib/emailApi';
import type { EmailCatalogEvent, EmailRule, EmailRuleWrite } from '@/lib/emailTypes';

function event(
  service: string,
  eventType: string,
  enabled = false,
): { catalog: EmailCatalogEvent; rule: EmailRule } {
  return {
    catalog: {
      service,
      eventType,
      templateKey: eventType,
      label: `Label ${eventType}`,
      laneClass: 'transactional',
      defaultLane: 'transactional',
      defaultEnabled: enabled,
      category: 'transactional',
      defaultTtlSeconds: null,
      variables: [],
      suggested: {
        en: { subject: 'Subject', preheader: '' },
        fr: { subject: 'Sujet', preheader: '' },
      },
    },
    rule: {
      eventType,
      service,
      templateKey: eventType,
      enabled,
      language: '',
      recipientMode: 'hints',
      staticRecipients: [],
      customized: false,
      defaultEnabled: enabled,
    },
  };
}

function clientFor(rows: ReturnType<typeof event>[]): EmailApiClient {
  const saveRule = vi.fn(async (_body: EmailRuleWrite) => undefined);
  const api = {
    fetchCatalog: vi.fn(async () => rows.map((row) => row.catalog)),
    fetchRules: vi.fn(async () => rows.map((row) => row.rule)),
    saveRule,
  };
  return api as unknown as EmailApiClient;
}

describe('ServiceEmailRulesSection', () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  it('lists only the current service and toggles that event with suggested defaults', async () => {
    const hosting = event('hosting', 'hosting.deployment.failed', true);
    const identity = event('identity', 'identity.user.created', false);
    const api = clientFor([hosting, identity]);
    render(
      <I18nextProvider i18n={i18n}>
        <ServiceEmailRulesSection
          service="hosting"
          client={api}
          canManage
          signedIn
        />
      </I18nextProvider>,
    );

    expect(await screen.findByText('Label hosting.deployment.failed')).toBeTruthy();
    expect(screen.queryByText('Label identity.user.created')).toBeNull();
    expect(document.querySelector('[data-email-service="hosting"]')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('switch', { name: 'Email for Label hosting.deployment.failed' }),
    );
    await waitFor(() => expect(api.saveRule).toHaveBeenCalledOnce());
    expect(api.saveRule).toHaveBeenCalledWith({
      event_type: 'hosting.deployment.failed',
      enabled: false,
      template_key: 'hosting.deployment.failed',
      language: '',
      recipient_mode: 'hints',
      static_recipients: [],
    });
  });

  it('shows a count only above 5 events and filters it with search', async () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      event('identity', `identity.group.item_${index}`),
    );
    render(
      <I18nextProvider i18n={i18n}>
        <ServiceEmailRulesSection
          service="identity"
          client={clientFor(rows)}
          canManage
          signedIn
        />
      </I18nextProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Events (6)' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search events'), { target: { value: 'item_1' } });
    expect(screen.getByRole('heading', { name: 'Events' })).toBeTruthy();
    expect(screen.getByText('Label identity.group.item_1')).toBeTruthy();
    expect(screen.queryByText('Label identity.group.item_0')).toBeNull();
  });
});
