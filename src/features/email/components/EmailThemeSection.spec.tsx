import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import shellui from '@shellui/sdk';
import i18n from '@/i18n';
import { EmailThemeSection } from '@/features/email/components/EmailThemeSection';
import type { EmailTheme } from '@/lib/emailTypes';

const themes: EmailTheme[] = [
  { key: 'barebone', name: 'Barebone', previewUrl: '/api/v1/themes/barebone/preview?language=en' },
  { key: 'matte', name: 'Matte', previewUrl: '/api/v1/themes/matte/preview?language=en' },
];

function renderSection(otherCount: number, onApply = vi.fn().mockResolvedValue(undefined)) {
  render(
    <I18nextProvider i18n={i18n}>
      <EmailThemeSection
        themes={themes}
        currentKey="barebone"
        otherCount={otherCount}
        previews={{ barebone: '<p>Bare</p>', matte: '<p>Hi</p>' }}
        feedback={null}
        onApply={onApply}
      />
    </I18nextProvider>,
  );
  return onApply;
}

describe('EmailThemeSection', () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  it('sandboxes the template preview and does not allow scripts', () => {
    renderSection(0);
    const frame = screen.getByTitle('Matte');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(frame.getAttribute('srcdoc')).toBe('<p>Hi</p>');
  });

  it('applies the template to new emails only when none use another template', async () => {
    shellui.dialog = vi.fn();
    const onApply = renderSection(0);
    fireEvent.click(screen.getByRole('button', { name: 'Matte' }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith('matte', false));
    expect(shellui.dialog).not.toHaveBeenCalled();
  });

  it('asks whether to switch existing emails and honors both choices', async () => {
    const dialog = vi.fn();
    shellui.dialog = dialog;
    const onApply = renderSection(3);
    fireEvent.click(screen.getByRole('button', { name: 'Matte' }));
    await waitFor(() => expect(dialog).toHaveBeenCalled());
    const options = dialog.mock.calls[0]?.[0] as {
      title: string;
      description: string;
      onOk: () => void;
      onCancel: () => void;
      secondaryButton: { label: string; onClick: () => void };
    };
    expect(options.title).toBe('Switch template?');
    expect(options.description).toBe('3 emails use another template. Switch them to Matte too?');
    expect(options.secondaryButton.label).toBe('Only new emails');
    options.onCancel();
    await waitFor(() => expect(onApply).not.toHaveBeenCalled());

    const matte = screen.getByRole('button', { name: 'Matte' });
    await waitFor(() => expect((matte as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(matte);
    const again = dialog.mock.calls[1]?.[0] as { onOk: () => void };
    again.onOk();
    await waitFor(() => expect(onApply).toHaveBeenCalledWith('matte', true));

    await waitFor(() => expect((matte as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(matte);
    const third = dialog.mock.calls[2]?.[0] as { secondaryButton: { onClick: () => void } };
    third.secondaryButton.onClick();
    await waitFor(() => expect(onApply).toHaveBeenCalledWith('matte', false));
  });
});
