import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { EmailRuleFormPage } from '@/features/email/pages/EmailRuleFormPage';
import type { EmailCatalogEvent, EmailRule } from '@/lib/emailTypes';

const emailApi = vi.hoisted(() => ({
  fetchCatalog: vi.fn(),
  fetchRule: vi.fn(),
  fetchLibrary: vi.fn(),
  createRule: vi.fn(),
  patchRule: vi.fn(),
  deleteRule: vi.fn(),
  fetchNewsletters: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'token',
}));

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({
    api: emailApi,
    canManage: true,
    baseUrl: 'https://email.shellui.com',
    companyId: 1,
  }),
}));

const userTheme = vi.hoisted(() => ({
  name: 'ocean',
  label: 'Ocean',
  colors: { primary: '#0a66c2' },
}));

vi.mock('@/features/email/useEmailThemes', () => ({
  useEmailThemes: () => ({ themes: [userTheme], current: userTheme }),
}));

vi.mock('@/features/email/components/EmailCopyEditor', () => ({
  EmailCopyEditor: ({ templateId }: { templateId: number }) => <p>Copy editor {templateId}</p>,
}));

vi.mock('@/features/actions/useWebhookPageMeta', () => ({
  useWebhookPageMeta: () => ({
    service: {
      key: 'email',
      labelKey: 'webhooksServiceEmail',
      badgeKey: 'webhooksBadgeEmail',
      pageTitleKey: 'webhooksPageTitleEmail',
      deliveriesPageTitleKey: 'webhooksDeliveriesPageTitleEmail',
      descriptionKey: 'webhooksPageDescriptionEmail',
      eventScopeKey: 'webhooksEventScopeEmail',
      baseUrl: 'https://email.example',
    },
    serviceConfigured: true,
  }),
}));

const event: EmailCatalogEvent = {
  service: 'email',
  eventType: 'email.newsletter.requested',
  templateKey: 'email.newsletter.requested',
  label: 'Newsletter sign-up requested',
  laneClass: 'transactional',
  defaultLane: 'transactional',
  defaultEnabled: false,
  category: 'transactional',
  defaultTtlSeconds: null,
  variables: [],
  linkToken: '',
  defaultTemplate: '',
  suggested: {},
};

function rule(overrides: Partial<EmailRule> = {}): EmailRule {
  return {
    id: 9,
    service: 'email',
    eventType: 'email.newsletter.requested',
    enabled: true,
    recipientMode: 'static',
    staticRecipients: ['sales@example.com'],
    language: '',
    templateId: 15,
    builtIn: false,
    newsletterId: 4,
    createdAt: '2026-10-26T07:00:00Z',
    updatedAt: '2026-10-26T07:00:00Z',
    ...overrides,
  };
}

function renderForm(path: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/:service/webhooks/email/:emailRuleId"
            element={<EmailRuleFormPage />}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EmailRuleFormPage newsletter filter', () => {
  afterEach(async () => {
    cleanup();
    for (const fn of Object.values(emailApi)) fn.mockReset();
    await i18n.changeLanguage('en');
  });

  it('binds a newsletter event rule to one list, and clears it with All newsletters', async () => {
    emailApi.fetchCatalog.mockResolvedValue({ events: [event], authLinkHosts: [] });
    emailApi.fetchRule.mockResolvedValue(rule());
    emailApi.fetchNewsletters.mockResolvedValue([
      { id: 4, name: 'Book a walkthrough' },
      { id: 5, name: 'Product news' },
    ]);
    emailApi.patchRule.mockResolvedValue(rule({ newsletterId: null }));
    renderForm('/email/webhooks/email/9');
    const select = (await screen.findByLabelText('Newsletter')) as HTMLSelectElement;
    await screen.findByRole('option', { name: 'Book a walkthrough' });
    expect(select.value).toBe('4');
    fireEvent.change(select, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(emailApi.patchRule).toHaveBeenCalledWith(9, {
        recipient_mode: 'static',
        static_recipients: ['sales@example.com'],
        language: '',
        newsletter_id: null,
      }),
    );
  });
});
