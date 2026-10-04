import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import shellui from '@shellui/sdk';
import i18n from '@/i18n';
import { EmailTemplateEditorPage } from '@/features/email/pages/EmailTemplateEditorPage';
import type {
  EmailEditorAction,
  EmailDraft,
} from '@/features/email/components/EmailTemplateEditor';
import { emptyEmailDocument } from '@/lib/emailDocument';
import type { EmailCatalogEvent } from '@/lib/emailTypes';

const api = vi.hoisted(() => ({
  fetchTemplate: vi.fn(),
  fetchCatalog: vi.fn(),
  fetchVersions: vi.fn(),
  fetchLibrary: vi.fn(),
  createVersion: vi.fn(),
  publishVersion: vi.fn(),
  sendTemplateTest: vi.fn(),
}));

vi.mock('@/hooks/useShelluiAccessToken', () => ({
  useShelluiAccessToken: () => 'token',
}));

vi.mock('@/features/email/useEmailApi', () => ({
  useEmailApi: () => ({ api, canManage: true, baseUrl: 'https://email.shellui.com', companyId: 1 }),
}));

vi.mock('@/features/email/components/EmailTemplateEditor', () => ({
  EmailTemplateEditor: (props: {
    draft: EmailDraft;
    head: string;
    primary?: EmailEditorAction;
    secondary?: EmailEditorAction;
  }) => (
    <div data-testid="editor">
      <p>Subject: {props.draft.subject}</p>
      <p>Head: {props.head}</p>
      <button
        type="button"
        onClick={() => void props.primary?.run()}
      >
        {props.primary?.label}
      </button>
      <button
        type="button"
        onClick={() => void props.secondary?.run()}
      >
        {props.secondary?.label}
      </button>
    </div>
  ),
}));

const magicLink: EmailCatalogEvent = {
  service: 'identity',
  eventType: 'identity.auth.magic_link.requested',
  templateKey: 'identity.auth.magic_link',
  label: 'Magic link requested',
  laneClass: 'auth',
  defaultLane: 'auth',
  defaultEnabled: true,
  category: 'auth',
  defaultTtlSeconds: 900,
  variables: [],
  linkToken: 'magic_link_url',
  defaultTemplate: 'barebone.magic-link',
  suggested: {},
};

const row = {
  id: 7,
  templateKey: 'company.abc',
  name: 'Sign-in link',
  eventType: 'identity.auth.magic_link.requested',
  language: 'en',
  companyId: 1,
  activeVersion: 1,
  sourceKey: 'barebone.magic-link',
  set: 'barebone',
  head: '.barebone {}',
};

function version(number: number, state: string, subject = 'Sign in') {
  return {
    number,
    state,
    subject,
    preheader: '',
    document: emptyEmailDocument(),
    publishedAt: null,
  };
}

function renderAt(path: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/email/templates/id/:templateId"
            element={<EmailTemplateEditorPage />}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EmailTemplateEditorPage', () => {
  afterEach(() => {
    cleanup();
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('names the email, the event it is sent for, and links back to the rules', async () => {
    api.fetchTemplate.mockResolvedValue(row);
    api.fetchCatalog.mockResolvedValue({ events: [magicLink], authLinkHosts: [] });
    api.fetchVersions.mockResolvedValue([version(1, 'published')]);

    renderAt('/email/templates/id/7');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign-in link' })).toBeTruthy();
    expect(screen.getByText('Sent for')).toBeTruthy();
    expect(screen.getByText('Magic link requested')).toBeTruthy();
    expect(screen.getByText('identity.auth.magic_link.requested')).toBeTruthy();
    expect(screen.getByText('Auth')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to rules' }).getAttribute('href')).toBe(
      '/identity/webhooks',
    );
    expect(screen.getByText('Subject: Sign in')).toBeTruthy();
    expect(screen.getByText('Head: .barebone {}')).toBeTruthy();
    expect(screen.queryByText(/Unpublished changes/)).toBeNull();
  });

  it('opens the latest draft, publishes it, and starts over from a library template', async () => {
    api.fetchTemplate.mockResolvedValue(row);
    api.fetchCatalog.mockResolvedValue({ events: [magicLink], authLinkHosts: [] });
    api.fetchVersions.mockResolvedValue([
      version(1, 'published'),
      version(2, 'draft', 'Draft subject'),
    ]);
    api.createVersion.mockResolvedValue({ number: 3 });
    api.publishVersion.mockResolvedValue({ number: 3, state: 'published' });
    api.fetchLibrary.mockResolvedValue({
      sets: [{ key: 'studio', name: 'Studio' }],
      templates: [
        {
          id: 31,
          key: 'studio.magic-link',
          set: 'studio',
          name: 'Studio sign-in',
          builtIn: true,
          companyId: null,
          subject: '',
          preheader: '',
          updatedAt: null,
          html: '',
        },
      ],
    });

    renderAt('/email/templates/id/7');
    expect(await screen.findByText('Subject: Draft subject')).toBeTruthy();
    expect(screen.getByText(/Unpublished changes/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.publishVersion).toHaveBeenCalledWith(7, 3));
    expect(api.createVersion).toHaveBeenCalledWith(7, {
      subject: 'Draft subject',
      preheader: '',
      document: {
        type: 'doc',
        content: [
          {
            type: 'container',
            content: [{ type: 'paragraph', attrs: { textId: expect.any(String) } }],
          },
        ],
      },
      translations: { fr: { subject: '', preheader: '', blocks: {} } },
    });

    const dialog = vi.fn();
    shellui.dialog = dialog;
    fireEvent.click(screen.getByRole('button', { name: 'Start over from another template' }));
    expect(await screen.findByRole('heading', { name: 'Pick a template' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /Studio sign-in/ }));
    const options = dialog.mock.calls[0]?.[0] as { description: string; onOk: () => void };
    expect(options.description).toContain('Studio sign-in');
    options.onOk();
    await waitFor(() => expect(api.createVersion).toHaveBeenLastCalledWith(7, { library_id: 31 }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Pick a template' })).toBeNull(),
    );
  });
});
