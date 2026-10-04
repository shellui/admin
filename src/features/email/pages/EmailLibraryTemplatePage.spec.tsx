import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { EmailLibraryTemplatePage } from '@/features/email/pages/EmailLibraryTemplatePage';
import type {
  EmailDraft,
  EmailEditorAction,
} from '@/features/email/components/EmailTemplateEditor';
import { emptyEmailDocument } from '@/lib/emailDocument';
import type { EmailLibraryDetail } from '@/lib/emailTypes';

const api = vi.hoisted(() => ({
  fetchLibraryTemplate: vi.fn(),
  createLibraryTemplate: vi.fn(),
  updateLibraryTemplate: vi.fn(),
  deleteLibraryTemplate: vi.fn(),
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
    readOnly?: boolean;
    primary?: EmailEditorAction;
    onChange: (next: EmailDraft) => void;
  }) => (
    <div data-testid="editor">
      <p>{props.readOnly ? 'Read-only' : 'Editable'}</p>
      <button
        type="button"
        onClick={() => props.onChange({ ...props.draft, subject: 'Changed' })}
      >
        Change subject
      </button>
      <button
        type="button"
        disabled={props.primary?.disabled}
        onClick={() => void props.primary?.run()}
      >
        {props.primary?.label}
      </button>
    </div>
  ),
}));

function detail(overrides: Partial<EmailLibraryDetail> = {}): EmailLibraryDetail {
  return {
    id: 4,
    key: 'studio.welcome',
    set: 'studio',
    name: 'Welcome',
    builtIn: true,
    companyId: null,
    subject: 'Welcome',
    preheader: '',
    updatedAt: null,
    html: '',
    document: emptyEmailDocument(),
    text: '',
    head: '',
    variables: [],
    ...overrides,
  };
}

function renderAt(path: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/email/templates/:libraryId"
            element={<EmailLibraryTemplatePage />}
          />
          <Route
            path="/email/templates"
            element={<p>Library</p>}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('EmailLibraryTemplatePage', () => {
  afterEach(() => {
    cleanup();
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('opens a built-in read-only and duplicates it to edit', async () => {
    api.fetchLibraryTemplate.mockImplementation(async (id: number) =>
      id === 4 ? detail() : detail({ id: 12, name: 'Welcome copy', builtIn: false, companyId: 1 }),
    );
    api.createLibraryTemplate.mockResolvedValue(detail({ id: 12, builtIn: false }));
    renderAt('/email/templates/4');
    expect(await screen.findByText('Read-only')).toBeTruthy();
    expect(screen.getByText('Built-in')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByLabelText('Name')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate to edit' }));
    await waitFor(() => expect(api.createLibraryTemplate).toHaveBeenCalledWith({ source_id: 4 }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome copy' })).toBeTruthy();
    expect(screen.getByText('Editable')).toBeTruthy();
  });

  it('saves the name and content of a company template, and deletes it', async () => {
    const custom = detail({ id: 12, name: 'Acme welcome', builtIn: false, companyId: 1 });
    api.fetchLibraryTemplate.mockResolvedValue(custom);
    api.updateLibraryTemplate.mockImplementation(async (_id: number, body: { name: string }) => ({
      ...custom,
      name: body.name,
    }));
    renderAt('/email/templates/12');
    const name = (await screen.findByLabelText('Name')) as HTMLInputElement;
    expect(name.value).toBe('Acme welcome');
    fireEvent.change(name, { target: { value: '' } });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(name, { target: { value: 'Acme hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change subject' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.updateLibraryTemplate).toHaveBeenCalledWith(12, {
        name: 'Acme hello',
        subject: 'Changed',
        preheader: '',
        document: emptyEmailDocument(),
      }),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Acme hello' })).toBeTruthy();

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Library')).toBeTruthy();
    expect(api.deleteLibraryTemplate).toHaveBeenCalledWith(12);
    confirm.mockRestore();
  });
});
