import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import shellui from '@shellui/sdk';
import i18n from '@/i18n';
import { EmailRuleFormPage } from '@/features/email/pages/EmailRuleFormPage';
import { EmailApiError } from '@/lib/emailApiErrors';
import type { EmailCatalogEvent, EmailRule, EmailTemplateRow } from '@/lib/emailTypes';

const emailApi = vi.hoisted(() => ({
  fetchCatalog: vi.fn(),
  fetchRule: vi.fn(),
  fetchTemplates: vi.fn(),
  createRule: vi.fn(),
  patchRule: vi.fn(),
  createTemplate: vi.fn(),
  publishVersion: vi.fn(),
  deleteRule: vi.fn(),
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

function catalogEvent(overrides: Partial<EmailCatalogEvent> = {}): EmailCatalogEvent {
  return {
    service: 'identity',
    eventType: 'identity.user.invited',
    templateKey: 'identity.user.invited',
    label: 'Invitation',
    laneClass: 'auth',
    defaultLane: 'auth',
    defaultEnabled: true,
    category: 'auth',
    defaultTtlSeconds: null,
    variables: [],
    suggested: {},
    ...overrides,
  };
}

function template(overrides: Partial<EmailTemplateRow> = {}): EmailTemplateRow {
  return {
    id: 15,
    templateKey: 'company.abc',
    name: 'Invite mail',
    eventType: 'identity.user.invited',
    language: 'en',
    companyId: 1,
    activeVersion: 1,
    theme: 'barebone',
    usesCompanyTheme: true,
    ...overrides,
  };
}

function rule(overrides: Partial<EmailRule> = {}): EmailRule {
  return {
    id: 9,
    service: 'identity',
    eventType: 'identity.user.invited',
    enabled: true,
    recipientMode: 'hints',
    staticRecipients: [],
    language: '',
    templateId: 15,
    builtIn: false,
    createdAt: '2026-10-03T12:00:00Z',
    updatedAt: '2026-10-03T12:00:00Z',
    ...overrides,
  };
}

function renderForm(path = '/identity/webhooks/email/new') {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/:service/webhooks/email/new"
            element={<EmailRuleFormPage />}
          />
          <Route
            path="/:service/webhooks/email/:emailRuleId"
            element={<EmailRuleFormPage />}
          />
          <Route
            path="/:service/webhooks"
            element={<p>Rules</p>}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EmailRuleFormPage', () => {
  afterEach(async () => {
    cleanup();
    emailApi.fetchCatalog.mockReset();
    emailApi.fetchRule.mockReset();
    emailApi.fetchTemplates.mockReset();
    emailApi.createRule.mockReset();
    emailApi.patchRule.mockReset();
    emailApi.createTemplate.mockReset();
    emailApi.publishVersion.mockReset();
    emailApi.deleteRule.mockReset();
    await i18n.changeLanguage('en');
  });

  it('creates a rule from the suggested email and from an existing template', async () => {
    emailApi.fetchCatalog.mockResolvedValue({
      events: [
        catalogEvent(),
        catalogEvent({
          service: 'hosting',
          eventType: 'hosting.deployment.failed',
          templateKey: 'hosting.deployment.failed',
          label: 'Deployment failed',
        }),
      ],
      authLinkHosts: [],
    });
    emailApi.fetchTemplates.mockImplementation(async (eventType: string) =>
      [
        template(),
        template({ id: 99, name: 'Hidden incompatible', eventType: 'hosting.deployment.failed' }),
      ].filter((row) => row.eventType === eventType),
    );
    emailApi.createRule.mockImplementation(async (body: { event_type: string }) =>
      rule({ id: 21, eventType: body.event_type, templateId: 21 }),
    );

    renderForm();
    fireEvent.click(await screen.findByRole('radio', { name: /Invitation/ }));
    expect(screen.queryByRole('radio', { name: /Deployment failed/ })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Specific addresses' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Addresses' }), {
      target: { value: 'a@example.com\nb@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'fr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(emailApi.createRule).toHaveBeenCalled());
    expect(emailApi.createRule).toHaveBeenCalledWith({
      event_type: 'identity.user.invited',
      service: 'identity',
      enabled: true,
      language: 'fr',
      recipient_mode: 'static',
      static_recipients: ['a@example.com', 'b@example.com'],
      content: { mode: 'suggested' },
    });
    expect((await screen.findByRole('link', { name: 'Edit email' })).getAttribute('href')).toBe(
      '/email/templates/id/21',
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Use an existing template' }));
    expect(await screen.findByRole('option', { name: 'Invite mail' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Hidden incompatible' })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Template' }), {
      target: { value: '15' },
    });
    emailApi.createRule.mockImplementation(async () => rule({ id: 22, templateId: 15 }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(emailApi.createRule).toHaveBeenLastCalledWith(
        expect.objectContaining({
          content: { mode: 'existing', template_id: 15 },
        }),
      ),
    );
    expect(emailApi.fetchTemplates).toHaveBeenCalledWith('identity.user.invited');
  });

  it('shows a translated mismatch error under save', async () => {
    emailApi.fetchCatalog.mockResolvedValue({ events: [catalogEvent()], authLinkHosts: [] });
    emailApi.fetchTemplates.mockResolvedValue([template()]);
    emailApi.createRule.mockRejectedValue(
      new EmailApiError('template_variables_mismatch', 400, {}, ['company_name']),
    );
    renderForm();
    fireEvent.click(await screen.findByRole('radio', { name: /Invitation/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Use an existing template' }));
    fireEvent.change(await screen.findByRole('combobox', { name: 'Template' }), {
      target: { value: '15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const failure = await screen.findByText('The template is missing variables: company_name.');
    expect(failure.className).toContain('text-destructive');
    expect(screen.getByRole('button', { name: 'Save' }).compareDocumentPosition(failure)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('keeps a built-in rule without a delete action and deletes others through shellui.dialog', async () => {
    emailApi.fetchCatalog.mockResolvedValue({ events: [catalogEvent()], authLinkHosts: [] });
    emailApi.fetchTemplates.mockResolvedValue([template()]);
    emailApi.fetchRule.mockResolvedValue(rule({ builtIn: true }));
    renderForm('/identity/webhooks/email/9');
    expect(
      await screen.findByText('The event stays the one this rule was created for.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByText('Built-in rules stay on.')).toBeTruthy();

    cleanup();
    emailApi.fetchRule.mockResolvedValue(rule({ builtIn: false }));
    const dialog = vi.fn();
    shellui.dialog = dialog;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderForm('/identity/webhooks/email/9');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(confirm).not.toHaveBeenCalled();
    const options = dialog.mock.calls[0]?.[0] as { mode: string; onOk: () => void };
    expect(options.mode).toBe('delete');
    options.onOk();
    await waitFor(() => expect(emailApi.deleteRule).toHaveBeenCalledWith(9));
    confirm.mockRestore();
  });

  it('publishes a suggested template when editing a rule', async () => {
    emailApi.fetchCatalog.mockResolvedValue({ events: [catalogEvent()], authLinkHosts: [] });
    emailApi.fetchTemplates.mockResolvedValue([template()]);
    emailApi.fetchRule.mockResolvedValue(rule());
    emailApi.createTemplate.mockResolvedValue({ id: 44, draftVersion: 2 });
    emailApi.publishVersion.mockResolvedValue({ number: 2, state: 'published', checksum: 'abc' });
    emailApi.patchRule.mockImplementation(async () => rule({ templateId: 44 }));
    renderForm('/identity/webhooks/email/9');
    fireEvent.click(await screen.findByRole('radio', { name: 'Start from the suggested email' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(emailApi.patchRule).toHaveBeenCalled());
    expect(emailApi.createTemplate).toHaveBeenCalledWith('identity.user.invited', 'en');
    expect(emailApi.publishVersion).toHaveBeenCalledWith(44, 2);
    expect(emailApi.patchRule).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ template_id: 44, language: '', recipient_mode: 'hints' }),
    );
    expect((await screen.findByRole('link', { name: 'Edit email' })).getAttribute('href')).toBe(
      '/email/templates/id/44',
    );
  });
});
