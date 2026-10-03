import { describe, expect, it, vi } from 'vitest';
import shellui from '@shellui/sdk';
import { askThemeSwitch } from '@/lib/themeSwitch';

describe('askThemeSwitch', () => {
  it('skips the dialog when no email uses another theme', async () => {
    shellui.dialog = vi.fn();
    const choice = await askThemeSwitch({
      otherCount: 0,
      title: 'Switch theme?',
      description: 'unused',
      allLabel: 'Switch all emails',
      newLabel: 'Only new emails',
      cancelLabel: 'Cancel',
    });
    expect(choice).toBe('new');
    expect(shellui.dialog).not.toHaveBeenCalled();
  });

  it('resolves both choices and cancel from the dialog', async () => {
    const dialog = vi.fn();
    shellui.dialog = dialog;
    const pending = askThemeSwitch({
      otherCount: 3,
      title: 'Switch theme?',
      description: '3 emails use another theme. Switch them to Matte too?',
      allLabel: 'Switch all emails',
      newLabel: 'Only new emails',
      cancelLabel: 'Cancel',
    });
    const options = dialog.mock.calls[0]?.[0] as {
      okLabel: string;
      secondaryButton: { label: string; onClick: () => void };
      onOk: () => void;
      onCancel: () => void;
    };
    expect(options.okLabel).toBe('Switch all emails');
    expect(options.secondaryButton.label).toBe('Only new emails');
    options.onOk();
    options.secondaryButton.onClick();
    expect(await pending).toBe('all');

    const onlyNew = askThemeSwitch({
      otherCount: 3,
      title: 'Switch theme?',
      description: '3 emails use another theme. Switch them to Matte too?',
      allLabel: 'Switch all emails',
      newLabel: 'Only new emails',
      cancelLabel: 'Cancel',
    });
    const second = dialog.mock.calls[1]?.[0] as { secondaryButton: { onClick: () => void } };
    second.secondaryButton.onClick();
    expect(await onlyNew).toBe('new');

    const cancelled = askThemeSwitch({
      otherCount: 1,
      title: 'Switch theme?',
      description: '1 emails use another theme. Switch them to Matte too?',
      allLabel: 'Switch all emails',
      newLabel: 'Only new emails',
      cancelLabel: 'Cancel',
    });
    const third = dialog.mock.calls[2]?.[0] as { onCancel: () => void };
    third.onCancel();
    expect(await cancelled).toBe('cancel');
  });
});
