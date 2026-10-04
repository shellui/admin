import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import {
  EmailTemplateEditor,
  type EmailLangDraft,
} from '@/features/email/components/EmailTemplateEditor';
import { EmailApiError } from '@/lib/emailApiErrors';
import { emptyEmailDocument } from '@/lib/emailDocument';
import { colorThemePalette } from '@/lib/emailTheme';

const renderEmailHtml = vi.hoisted(() =>
  vi.fn(async (input: { template: string; palette: Record<string, string> | null }) => {
    return `<p data-template="${input.template}">${JSON.stringify(input.palette)}</p><p>{{ company_name }} {{ display_name|default:&quot;there&quot; }} {{ unknown }}</p>`;
  }),
);

vi.mock('@/features/email/templates/renderEmail', () => ({ renderEmailHtml }));

beforeAll(async () => {
  await import('@/features/email/editor/EmailInlineEditor');
}, 30_000);

const draft: EmailLangDraft = {
  subject: 'Hello',
  preheader: '',
  document: emptyEmailDocument(),
  templateId: 4,
};

type Props = Parameters<typeof EmailTemplateEditor>[0];

function Harness(overrides: Partial<Props>) {
  const [en, setEn] = useState(draft);
  return (
    <EmailTemplateEditor
      laneClass="transactional"
      authLinkHosts={[]}
      storedTemplate={null}
      languages={['en']}
      draftEn={en}
      draftFr={draft}
      variables={[]}
      hasCompanyTemplate
      publishing={false}
      resetting={false}
      sendingDraft={false}
      isStaff={false}
      jwtEmail="ada@acme.com"
      onChange={(_lang, next) => setEn(next)}
      onPublish={vi.fn(async () => undefined)}
      onReset={vi.fn(async () => false)}
      onSendDraft={vi.fn(async () => undefined)}
      {...overrides}
    />
  );
}

function renderEditor(overrides: Partial<Props> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <Harness {...overrides} />
    </I18nextProvider>,
  );
}

function themeButton() {
  return screen.getByRole('button', { name: /^Theme/ });
}

function pickTheme(name: string) {
  fireEvent.click(themeButton());
  fireEvent.click(screen.getByRole('radio', { name }));
}

describe('EmailTemplateEditor send this draft', () => {
  afterEach(async () => {
    cleanup();
    renderEmailHtml.mockClear();
    await i18n.changeLanguage('en');
  });

  it('shows the result under the button and clears it when the draft changes', async () => {
    const onSendDraft = vi
      .fn<(to?: string) => Promise<void>>()
      .mockRejectedValueOnce(new EmailApiError('provider_test_failed', 502))
      .mockResolvedValueOnce(undefined);
    renderEditor({
      onSendDraft: (_lang, _draft, _template, _palette, to) => onSendDraft(to),
    });

    const send = screen.getByRole('button', { name: 'Send this draft' });
    fireEvent.click(send);
    expect(screen.getByRole('dialog', { name: 'Send this draft' }).textContent).toContain(
      'To ada@acme.com',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.queryByRole('dialog', { name: 'Send this draft' })).toBeNull();
    const failure = await screen.findByText('The provider refused the test email.');
    expect(failure.className).toContain('text-destructive');
    expect(send.closest('div.border-t')?.contains(failure)).toBe(true);
    expect(onSendDraft).toHaveBeenCalledWith(undefined);

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello again' } });
    expect(screen.queryByText('The provider refused the test email.')).toBeNull();

    fireEvent.click(send);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    const sent = await screen.findByText('Draft sent.');
    expect(sent.className).not.toContain('text-destructive');
    expect(send.closest('div.border-t')?.contains(sent)).toBe(true);
    expect(screen.queryByText('The provider refused the test email.')).toBeNull();
  });

  it('lets staff pick the recipient in the send panel', async () => {
    const onSendDraft = vi.fn<(to?: string) => Promise<void>>().mockResolvedValue(undefined);
    renderEditor({
      isStaff: true,
      onSendDraft: (_lang, _draft, _template, _palette, to) => onSendDraft(to),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send this draft' }));
    const recipient = screen.getByLabelText('Test recipient') as HTMLInputElement;
    expect(recipient.value).toBe('ada@acme.com');
    fireEvent.change(recipient, { target: { value: '' } });
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(recipient, { target: { value: ' grace@acme.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Draft sent.');
    expect(onSendDraft).toHaveBeenCalledWith('grace@acme.com');
  });

  it('shows a publish failure under Publish', async () => {
    renderEditor({
      onPublish: vi.fn(async () => {
        throw new EmailApiError('provider_test_failed', 502);
      }),
    });
    const publish = screen.getByRole('button', { name: 'Publish' });
    fireEvent.click(publish);
    const failure = await screen.findByText('The provider refused the test email.');
    expect(failure.className).toContain('text-destructive');
    expect(publish.parentElement?.contains(failure)).toBe(true);
    expect(screen.queryAllByText('The provider refused the test email.')).toHaveLength(1);
  });
});

describe('EmailTemplateEditor look and modes', () => {
  afterEach(async () => {
    cleanup();
    renderEmailHtml.mockClear();
    await i18n.changeLanguage('en');
  });

  it('renders the preview locally with the picked template and theme, and publishes both', async () => {
    const onPublish = vi.fn(async () => undefined);
    renderEditor({ storedTemplate: 'matte', onPublish });
    await waitFor(() =>
      expect(renderEmailHtml).toHaveBeenLastCalledWith(
        expect.objectContaining({ template: 'matte', palette: {} }),
      ),
    );

    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'studio' } });
    pickTheme('Ocean');
    const ocean = colorThemePalette('ocean');
    await waitFor(() =>
      expect(renderEmailHtml).toHaveBeenLastCalledWith(
        expect.objectContaining({ template: 'studio', palette: ocean }),
      ),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    const frame = await screen.findByTitle('Preview');
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.getAttribute('srcdoc')).toContain('data-template="studio"');

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(onPublish).toHaveBeenCalledWith('studio', ocean));
  });

  it('fills the preview and its inbox line with example values', async () => {
    renderEditor({
      draftEn: { ...draft, subject: 'Welcome to {{ company_name }}', preheader: 'Hi {{ name }}' },
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
    expect(frame.getAttribute('srcdoc')).toContain('<p>Acme &amp; Co there {{ unknown }}</p>');
    expect(screen.getByText('Welcome to Acme & Co')).toBeTruthy();
    expect(screen.getByText('Hi {{ name }}')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Service preview' })).toBeNull();
  });

  it('reselects the stored color theme, or offers the saved colors', () => {
    renderEditor({ storedPalette: colorThemePalette('forest') });
    expect(themeButton().textContent).toContain('Forest');
    cleanup();
    renderEditor({ storedPalette: { ...colorThemePalette('forest')!, primary: '#000000' } });
    expect(themeButton().textContent).toContain('Saved colors');
    fireEvent.click(themeButton());
    expect(screen.getByRole('radio', { name: 'Saved colors' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('switches between edit, preview, and JSON, and applies pasted JSON', async () => {
    renderEditor();
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.queryByLabelText('Subject')).toBeNull();
    expect(await screen.findByTitle('Preview')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
    const json = screen.getByLabelText('Template JSON') as HTMLTextAreaElement;
    expect(JSON.parse(json.value)).toEqual({
      subject: 'Hello',
      preheader: '',
      document: { preview: '', blocks: [] },
      theme_name: 'barebone',
      theme_palette: {},
    });

    fireEvent.change(json, { target: { value: '{ "subject": ' } });
    expect(screen.getByText('This is not valid JSON yet.')).toBeTruthy();

    fireEvent.change(json, {
      target: {
        value: JSON.stringify({
          subject: 'Pasted',
          document: { preview: '', blocks: [{ type: 'heading', text: 'Hi' }] },
          theme_name: 'arcane',
          theme_palette: colorThemePalette('plum'),
        }),
      },
    });
    expect(screen.queryByText('This is not valid JSON yet.')).toBeNull();
    expect(themeButton().textContent).toContain('Plum');
    expect((screen.getByLabelText('Template') as HTMLSelectElement).value).toBe('arcane');

    fireEvent.click(screen.getByRole('tab', { name: 'Edit' }));
    expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toBe('Pasted');
    const canvas = await screen.findByRole('textbox', { name: 'Content' });
    await waitFor(() => expect(canvas.querySelector('h1')?.textContent).toBe('Hi'));
  });
});

describe('EmailTemplateEditor inline canvas', () => {
  afterEach(async () => {
    cleanup();
    renderEmailHtml.mockClear();
    await i18n.changeLanguage('en');
  });

  const rich: EmailLangDraft = {
    ...draft,
    document: {
      preview: '',
      blocks: [
        { type: 'heading', text: 'Welcome' },
        {
          type: 'text',
          text: 'Read the docs.',
          content: [
            { text: 'Read ' },
            { text: 'the docs', bold: true, href: 'https://shellui.com/docs' },
            { text: '.' },
          ],
        },
        { type: 'list', items: [{ text: 'One' }, { text: 'Two' }] },
        { type: 'divider' },
        { type: 'button', text: 'Open', href: '{{ app_url }}' },
      ],
    },
  };

  function Seeded(overrides: Partial<Props>) {
    const [en, setEn] = useState(rich);
    return (
      <Harness
        draftEn={en}
        onChange={(_lang, next) => setEn(next)}
        {...overrides}
      />
    );
  }

  it('renders the document as a themed email that follows the template and colors', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Seeded storedTemplate="studio" />
      </I18nextProvider>,
    );
    const canvas = await screen.findByRole('textbox', { name: 'Content' });
    await waitFor(() => expect(canvas.querySelector('h1')?.textContent).toBe('Welcome'));
    expect(canvas.querySelector('strong')?.textContent).toBe('the docs');
    expect(canvas.querySelector('a.node-link')?.getAttribute('href')).toBe(
      'https://shellui.com/docs',
    );
    expect(canvas.querySelectorAll('ul > li')).toHaveLength(2);
    expect(canvas.querySelector('hr')).toBeTruthy();
    expect(canvas.querySelector('a.node-button')?.textContent).toBe('Open');

    const frame = canvas.closest('.email-canvas') as HTMLElement;
    expect(frame.dataset.template).toBe('studio');
    expect(frame.querySelector('.email-canvas-bar')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'matte' } });
    pickTheme('Ocean');
    expect(frame.dataset.template).toBe('matte');
    expect(frame.querySelector('.email-canvas-bar')).toBeNull();
    expect(frame.style.getPropertyValue('--email-primary')).toBe(
      colorThemePalette('ocean')!.primary,
    );
    expect(screen.getByRole('textbox', { name: 'Content' })).toBe(canvas);
  });

  it('inserts a variable chip into the body and keeps rich text in the JSON', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Seeded
          variables={[
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
          ]}
        />
      </I18nextProvider>,
    );
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
    const json = JSON.parse((screen.getByLabelText('Template JSON') as HTMLTextAreaElement).value);
    const blocks = json.document.blocks;
    expect(JSON.stringify(blocks)).toContain('{{ company_name }}');
    expect(blocks.find((block: { type: string }) => block.type === 'text').content).toContainEqual({
      text: 'the docs',
      bold: true,
      href: 'https://shellui.com/docs',
    });
    expect(blocks.map((block: { type: string }) => block.type)).toEqual(
      expect.arrayContaining(['heading', 'text', 'list', 'divider', 'button']),
    );
  });
});
