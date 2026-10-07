import shellui from '@shellui/sdk';

export type ThemeSwitchChoice = 'all' | 'new' | 'cancel';

/**
 * Three-way theme choice. `templatesUsingOtherTheme === 0` skips the dialog
 * and keeps existing emails on their theme.
 */
export function askThemeSwitch(options: {
  otherCount: number;
  title: string;
  description: string;
  allLabel: string;
  newLabel: string;
  cancelLabel: string;
}): Promise<ThemeSwitchChoice> {
  if (options.otherCount <= 0) return Promise.resolve('new');
  return new Promise((resolve) => {
    let settled = false;
    const finish = (choice: ThemeSwitchChoice) => {
      if (settled) return;
      settled = true;
      resolve(choice);
    };
    shellui.dialog({
      title: options.title,
      description: options.description,
      mode: 'confirm',
      okLabel: options.allLabel,
      cancelLabel: options.cancelLabel,
      secondaryButton: {
        label: options.newLabel,
        onClick: () => finish('new'),
      },
      onOk: () => finish('all'),
      onCancel: () => finish('cancel'),
    });
  });
}
