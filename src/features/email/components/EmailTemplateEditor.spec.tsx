import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import {
  EmailTemplateEditor,
  type EmailDraft,
} from '@/features/email/components/EmailTemplateEditor';
import { EmailApiError } from '@/lib/emailApiErrors';
import { emptyEmailDocument, type EmailDocument } from '@/lib/emailDocument';

const composeEmailHtml = vi.hoisted(() =>
  vi.fn(async (input: { head: string; preheader: string }) => {
    return `<style>${input.head}</style><p>${input.preheader}</p><p>{{ company_name }} {{ display_name|default:&quot;there&quot; }} {{ unknown }}</p><img src="{{ system.assets_url }}/logo.png">`;
  }),
);

vi.mock('@/features/email/editor/composeEmail', () => ({ composeEmailHtml }));

beforeAll(async () => {
  // jsdom has no layout; the bubble menu measures the selection.
  const proto = Range.prototype as Partial<Range>;
  proto.getClientRects ??= () => [] as unknown as DOMRectList;
  proto.getBoundingClientRect ??= () => new DOMRect();
  await import('@/features/email/editor/EmailInlineEditor');
}, 30_000);

const draft: EmailDraft = {
  subject: 'Hello',
  preheader: '',
  document: emptyEmailDocument(),
};

type Props = Parameters<typeof EmailTemplateEditor>[0];

function Harness({ initial = draft, ...overrides }: Partial<Props> & { initial?: EmailDraft }) {
  const [value, setValue] = useState(initial);
  return (
    <EmailTemplateEditor
      laneClass="transactional"
      authLinkHosts={[]}
      head=""
      assetsUrl="https://email.shellui.com/static/library"
      draft={value}
      variables={[]}
      onChange={setValue}
      {...overrides}
    />
  );
}

function renderEditor(overrides: Partial<Props> & { initial?: EmailDraft } = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <Harness {...overrides} />
    </I18nextProvider>,
  );
}

afterEach(async () => {
  cleanup();
  composeEmailHtml.mockClear();
  await i18n.changeLanguage('en');
});

describe('EmailTemplateEditor actions', () => {
  it('shows the send result under the button and clears it when the draft changes', async () => {
    const run = vi
      .fn<(to?: string) => Promise<void>>()
      .mockRejectedValueOnce(new EmailApiError('provider_test_failed', 502))
      .mockResolvedValueOnce(undefined);
    renderEditor({ sendDraft: { isStaff: false, jwtEmail: 'ada@acme.com', sending: false, run } });

    const send = screen.getByRole('button', { name: 'Send this draft' });
    fireEvent.click(send);
    expect(screen.getByRole('dialog', { name: 'Send this draft' }).textContent).toContain(
      'To ada@acme.com',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    const failure = await screen.findByText('The provider refused the test email.');
    expect(failure.className).toContain('text-destructive');
    expect(send.closest('div.border-t')?.contains(failure)).toBe(true);
    expect(run).toHaveBeenCalledWith(undefined);

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello again' } });
    expect(screen.queryByText('The provider refused the test email.')).toBeNull();

    fireEvent.click(send);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    const sent = await screen.findByText('Draft sent.');
    expect(sent.className).not.toContain('text-destructive');
  });

  it('lets staff pick the recipient in the send panel', async () => {
    const run = vi.fn<(to?: string) => Promise<void>>().mockResolvedValue(undefined);
    renderEditor({ sendDraft: { isStaff: true, jwtEmail: 'ada@acme.com', sending: false, run } });
    fireEvent.click(screen.getByRole('button', { name: 'Send this draft' }));
    const recipient = screen.getByLabelText('Test recipient') as HTMLInputElement;
    expect(recipient.value).toBe('ada@acme.com');
    fireEvent.change(recipient, { target: { value: '' } });
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(recipient, { target: { value: ' grace@acme.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Draft sent.');
    expect(run).toHaveBeenCalledWith('grace@acme.com');
  });

  it('shows each action result under its own button', async () => {
    renderEditor({
      primary: {
        label: 'Publish',
        run: vi.fn(async () => {
          throw new EmailApiError('provider_test_failed', 502);
        }),
        doneText: 'Email published.',
      },
      secondary: { label: 'Start over', run: vi.fn(async () => false), doneText: '' },
    });
    const publish = screen.getByRole('button', { name: 'Publish' });
    fireEvent.click(publish);
    const failure = await screen.findByText('The provider refused the test email.');
    expect(publish.parentElement?.contains(failure)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    await waitFor(() =>
      expect(screen.queryByText('The provider refused the test email.')).toBeNull(),
    );
  });
});

describe('EmailTemplateEditor preview and modes', () => {
  it('composes the preview with the set head and fills example values', async () => {
    renderEditor({
      head: '.title { color: red }',
      initial: { ...draft, subject: 'Welcome to {{ company_name }}', preheader: 'Hi {{ name }}' },
      variables: [
        {
          token: 'company_name',
          type: 'string',
          required: false,
          description: '',
          example: 'Acme & Co',
          isUrl: false,
        },
      ],
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    const frame = await screen.findByTitle('Preview');
    expect(frame.getAttribute('sandbox')).toBe('');
    const html = frame.getAttribute('srcdoc') ?? '';
    expect(html).toContain('<style>.title { color: red }</style>');
    expect(html).toContain('<p>Acme &amp; Co there {{ unknown }}</p>');
    expect(html).toContain('src="https://email.shellui.com/static/library/logo.png"');
    expect(composeEmailHtml).toHaveBeenLastCalledWith(
      expect.objectContaining({ head: '.title { color: red }', preheader: 'Hi {{ name }}' }),
    );
    expect(screen.getByText('Welcome to Acme & Co')).toBeTruthy();
  });

  it('switches between edit, preview, and JSON, and applies pasted JSON', async () => {
    renderEditor();
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.queryByLabelText('Subject')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
    const json = screen.getByLabelText('Template JSON') as HTMLTextAreaElement;
    expect(JSON.parse(json.value)).toEqual({
      subject: 'Hello',
      preheader: '',
      document: emptyEmailDocument(),
    });

    fireEvent.change(json, { target: { value: '{ "subject": ' } });
    expect(screen.getByText('This is not valid JSON yet.')).toBeTruthy();

    const pasted: EmailDocument = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Hi' }],
        },
      ],
    };
    fireEvent.change(json, {
      target: { value: JSON.stringify({ subject: 'Pasted', document: pasted }) },
    });
    expect(screen.queryByText('This is not valid JSON yet.')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Edit' }));
    expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toBe('Pasted');
    const canvas = await screen.findByRole('textbox', { name: 'Content' });
    await waitFor(() => expect(canvas.querySelector('h1')?.textContent).toBe('Hi'));
  });

  it('opens built-in designs read-only, without the edit mode', async () => {
    renderEditor({ readOnly: true });
    expect(screen.queryByRole('tab', { name: 'Edit' })).toBeNull();
    expect(await screen.findByTitle('Preview')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
    expect((screen.getByLabelText('Template JSON') as HTMLTextAreaElement).readOnly).toBe(true);
  });
});

describe('EmailTemplateEditor inline canvas', () => {
  const rich: EmailDraft = {
    ...draft,
    document: {
      type: 'doc',
      content: [
        {
          type: 'container',
          attrs: { style: 'max-width:600px;margin:0 auto' },
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Welcome' }] },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Read ' },
                {
                  type: 'text',
                  text: 'the docs',
                  marks: [
                    { type: 'bold' },
                    { type: 'link', attrs: { href: 'https://shellui.com/docs' } },
                  ],
                },
              ],
            },
            {
              type: 'image',
              attrs: { src: '{{ system.assets_url }}/logo.png', alt: 'Logo' },
            },
            {
              type: 'button',
              attrs: { href: '{{ app_url }}' },
              content: [{ type: 'text', text: 'Open' }],
            },
          ],
        },
      ],
    },
  };

  it('renders the layout, swaps the assets token for the canvas, and keeps it in the JSON', async () => {
    renderEditor({
      initial: rich,
      head: '* { font-family: Inter } body { background: #eee } .title { color: red }',
    });
    const canvas = await screen.findByRole('textbox', { name: 'Content' });
    await waitFor(() => expect(canvas.querySelector('h1')?.textContent).toBe('Welcome'));
    expect(canvas.querySelector('strong')?.textContent).toBe('the docs');
    expect(canvas.querySelector('img')?.getAttribute('src')).toBe(
      'https://email.shellui.com/static/library/logo.png',
    );
    const style = (
      canvas.closest('.email-canvas')?.parentElement?.querySelector('style')?.textContent ?? ''
    ).replace(/\s+/g, '');
    expect(style).toContain('.email-canvas,.email-canvas*{font-family:Inter}');
    expect(style).toContain('.email-canvas{background:#eee}');
    expect(style).not.toContain('body');

    fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
    const json = JSON.parse((screen.getByLabelText('Template JSON') as HTMLTextAreaElement).value);
    expect(JSON.stringify(json.document)).toContain('{{ system.assets_url }}/logo.png');
  });

  it('inserts a variable chip into the body', async () => {
    renderEditor({
      initial: rich,
      variables: [
        {
          token: 'company_name',
          type: 'string',
          required: false,
          description: 'Company name',
          example: 'Acme',
          isUrl: false,
        },
        {
          token: 'app_url',
          type: 'url',
          required: true,
          description: 'email.var.app_url',
          example: 'https://app.shellui.com',
          isUrl: true,
        },
      ],
    });
    const canvas = await screen.findByRole('textbox', { name: 'Content' });
    await waitFor(() => expect(canvas.querySelector('h1')).toBeTruthy());
    const group = screen.getByRole('group', { name: 'Variables' });
    const appUrl = within(group).getByRole('button', { name: 'app_url' });
    expect(appUrl.textContent).toBe('{{ app_url }}required');
    expect(appUrl.getAttribute('title')).toBe('Example: https://app.shellui.com');
    fireEvent.click(within(group).getByRole('button', { name: 'company_name' }));
    await waitFor(() => expect(canvas.textContent).toContain('{{ company_name }}'));
    expect(canvas.querySelector('.email-token')?.textContent).toBe('{{ company_name }}');

    fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
    const json = (screen.getByLabelText('Template JSON') as HTMLTextAreaElement).value;
    expect(json).toContain('{{ company_name }}');
  });
});
