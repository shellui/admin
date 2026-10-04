import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import shellui from '@shellui/sdk';
import i18n from '@/i18n';
import { EmailRuleFormPage } from '@/features/email/pages/EmailRuleFormPage';
import { EmailApiError } from '@/lib/emailApiErrors';
import type { EmailCatalogEvent, EmailLibraryTemplate, EmailRule } from '@/lib/emailTypes';

const emailApi = vi.hoisted(() => ({
  fetchCatalog: vi.fn(),
  fetchRule: vi.fn(),
  fetchLibrary: vi.fn(),
  createRule: vi.fn(),
  patchRule: vi.fn(),
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

vi.mock('@/features/email/components/EmailCopyEditor', () => ({
  EmailCopyEditor: ({ templateId }: { templateId: number }) => <p>Copy editor {templateId}</p>,
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
    linkToken: 'invitation_url',
    defaultTemplate: 'barebone.invite',
    suggested: {},
    ...overrides,
  };
}

function design(id: number, key: string, name: string): EmailLibraryTemplate {
  return {
    id,
    key,
    set: key.split('.')[0] ?? '',
    name,
    builtIn: true,
    companyId: null,
    subject: '',
    preheader: '',
    updatedAt: null,
    html: '',
  };
}

const library = {
  sets: [
    { key: 'barebone', name: 'Barebone' },
    { key: 'studio', name: 'Studio' },
  ],
  templates: [
    design(3, 'barebone.invite', 'Barebone invite'),
    design(4, 'barebone.alert', 'Barebone alert'),
    design(7, 'studio.invite', 'Studio invite'),
  ],
};

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
    for (const fn of Object.values(emailApi)) fn.mockReset();
    await i18n.changeLanguage('en');
  });

  function designCard(name: string): HTMLButtonElement {
    return screen.getByRole('button', { name: new RegExp(name) }) as HTMLButtonElement;
  }

  it('picks an event, suggests its design, creates the rule from a library template, and opens it', async () => {
    emailApi.fetchCatalog.mockResolvedValue({
      events: [
        catalogEvent(),
        catalogEvent({
          eventType: 'identity.user.deleted',
          label: 'User deleted',
          defaultTemplate: 'barebone.alert',
        }),
        catalogEvent({
          service: 'hosting',
          eventType: 'hosting.deployment.failed',
          label: 'Deployment failed',
        }),
      ],
      authLinkHosts: [],
    });
    emailApi.fetchLibrary.mockResolvedValue(library);
    emailApi.fetchRule.mockResolvedValue(rule({ id: 21, templateId: 33 }));
    emailApi.createRule.mockResolvedValue(rule({ id: 21, templateId: 33 }));

    renderForm();
    fireEvent.click(await screen.findByRole('radio', { name: /Invitation/ }));
    expect(screen.queryByRole('radio', { name: /Deployment failed/ })).toBeNull();
    expect(designCard('Barebone invite').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: /User deleted/ }));
    expect(designCard('Barebone alert').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(designCard('Studio invite'));
    fireEvent.click(screen.getByRole('radio', { name: /Invitation/ }));
    expect(designCard('Studio invite').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('radio', { name: 'Specific addresses' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Addresses' }), {
      target: { value: 'a@example.com\nb@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'fr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create email rule' }));

    await waitFor(() =>
      expect(emailApi.createRule).toHaveBeenCalledWith({
        event_type: 'identity.user.invited',
        service: 'identity',
        enabled: true,
        language: 'fr',
        recipient_mode: 'static',
        static_recipients: ['a@example.com', 'b@example.com'],
        content: { library_id: 7 },
      }),
    );
    expect(await screen.findByText('Copy editor 33')).toBeTruthy();
    expect(emailApi.fetchRule).toHaveBeenCalledWith(21);
  });

  it('asks for a design when the event has no default one', async () => {
    emailApi.fetchCatalog.mockResolvedValue({
      events: [catalogEvent({ defaultTemplate: '' })],
      authLinkHosts: [],
    });
    emailApi.fetchLibrary.mockResolvedValue(library);
    renderForm();
    fireEvent.click(await screen.findByRole('radio', { name: /Invitation/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create email rule' }));
    expect(await screen.findByText('Choose a design.')).toBeTruthy();
    expect(emailApi.createRule).not.toHaveBeenCalled();
  });

  it('shows a translated mismatch error under save', async () => {
    emailApi.fetchCatalog.mockResolvedValue({ events: [catalogEvent()], authLinkHosts: [] });
    emailApi.fetchLibrary.mockResolvedValue(library);
    emailApi.createRule.mockRejectedValue(
      new EmailApiError('template_variables_mismatch', 400, {}, ['company_name']),
    );
    renderForm();
    fireEvent.click(await screen.findByRole('radio', { name: /Invitation/ }));
    const save = screen.getByRole('button', { name: 'Create email rule' });
    fireEvent.click(save);
    const failure = await screen.findByText('The template is missing variables: company_name.');
    expect(failure.className).toContain('text-destructive');
    expect(save.compareDocumentPosition(failure)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('edits recipients and language, and shows the copy editor below', async () => {
    emailApi.fetchCatalog.mockResolvedValue({ events: [catalogEvent()], authLinkHosts: [] });
    emailApi.fetchRule.mockResolvedValue(rule());
    emailApi.patchRule.mockResolvedValue(rule({ language: 'en' }));
    renderForm('/identity/webhooks/email/9');
    expect(await screen.findByText('Copy editor 15')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Barebone' })).toBeNull();
    expect(emailApi.fetchLibrary).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'en' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(emailApi.patchRule).toHaveBeenCalledWith(9, {
        recipient_mode: 'hints',
        static_recipients: [],
        language: 'en',
      }),
    );
    expect(await screen.findByText('Email rule saved.')).toBeTruthy();
  });

  it('keeps a built-in rule without a delete action and deletes others through shellui.dialog', async () => {
    emailApi.fetchCatalog.mockResolvedValue({ events: [catalogEvent()], authLinkHosts: [] });
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
});
