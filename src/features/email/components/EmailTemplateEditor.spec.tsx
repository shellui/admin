import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import {
  EmailTemplateEditor,
  type EmailLangDraft,
} from '@/features/email/components/EmailTemplateEditor';
import { EmailApiError } from '@/lib/emailApiErrors';
import { emptyEmailDocument } from '@/lib/emailDocument';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => null,
}));

const draft: EmailLangDraft = {
  subject: 'Hello',
  preheader: '',
  document: emptyEmailDocument(),
  templateId: 4,
};

function renderEditor(onSendDraft: (to?: string) => Promise<void>) {
  render(
    <I18nextProvider i18n={i18n}>
      <EmailTemplateEditor
        templateKey="hosting.deployment.failed"
        laneClass="transactional"
        authLinkHosts={[]}
        storedThemeName={null}
        draftEn={draft}
        draftFr={draft}
        variables={[]}
        hasCompanyTemplate
        publishing={false}
        resetting={false}
        sendingDraft={false}
        isStaff={false}
        jwtEmail="ada@acme.com"
        onChange={vi.fn()}
        onPublish={vi.fn(async () => undefined)}
        onReset={vi.fn(async () => false)}
        onSendDraft={(_lang, _draft, _palette, to) => onSendDraft(to)}
        onServicePreview={vi.fn(async () => undefined)}
        servicePreviewHtml={null}
        servicePreviewNote={null}
      />
    </I18nextProvider>,
  );
}

describe('EmailTemplateEditor send this draft', () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  it('shows the result under the button and clears it when the draft changes', async () => {
    const onSendDraft = vi
      .fn<(to?: string) => Promise<void>>()
      .mockRejectedValueOnce(new EmailApiError('provider_test_failed', 502))
      .mockResolvedValueOnce(undefined);
    renderEditor(onSendDraft);

    const send = screen.getByRole('button', { name: 'Send this draft' });
    fireEvent.click(send);
    const failure = await screen.findByText('The provider refused the test email.');
    expect(failure.className).toContain('text-destructive');
    expect(send.closest('div.border-t')?.contains(failure)).toBe(true);
    expect(onSendDraft).toHaveBeenCalledWith(undefined);

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello again' } });
    expect(screen.queryByText('The provider refused the test email.')).toBeNull();

    fireEvent.click(send);
    const sent = await screen.findByText('Draft sent.');
    expect(sent.className).not.toContain('text-destructive');
    expect(send.closest('div.border-t')?.contains(sent)).toBe(true);
    expect(screen.queryByText('The provider refused the test email.')).toBeNull();
  });

  it('shows a publish failure under Publish', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <EmailTemplateEditor
          templateKey="hosting.deployment.failed"
          laneClass="transactional"
          authLinkHosts={[]}
          storedThemeName={null}
          draftEn={draft}
          draftFr={draft}
          variables={[]}
          hasCompanyTemplate
          publishing={false}
          resetting={false}
          sendingDraft={false}
          isStaff={false}
          jwtEmail="ada@acme.com"
          onChange={vi.fn()}
          onPublish={vi.fn(async () => {
            throw new EmailApiError('provider_test_failed', 502);
          })}
          onReset={vi.fn(async () => false)}
          onSendDraft={vi.fn(async () => undefined)}
          onServicePreview={vi.fn(async () => undefined)}
          servicePreviewHtml={null}
          servicePreviewNote={null}
        />
      </I18nextProvider>,
    );
    const publish = screen.getByRole('button', { name: 'Publish' });
    fireEvent.click(publish);
    const failure = await screen.findByText('The provider refused the test email.');
    expect(failure.className).toContain('text-destructive');
    expect(publish.parentElement?.contains(failure)).toBe(true);
    expect(screen.queryAllByText('The provider refused the test email.')).toHaveLength(1);
  });
});
