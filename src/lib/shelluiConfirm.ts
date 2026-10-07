import shellui from '@shellui/sdk';

/**
 * Confirm through `shellui.dialog` in every window, including a top-level tab.
 * Email rule delete uses this so it never falls back to `window.confirm`.
 */
export function askShelluiConfirm(options: {
  title: string;
  description: string;
  okLabel: string;
  cancelLabel: string;
  mode?: 'confirm' | 'delete';
}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    shellui.dialog({
      title: options.title,
      description: options.description,
      mode: options.mode ?? 'confirm',
      okLabel: options.okLabel,
      cancelLabel: options.cancelLabel,
      onOk: () => finish(true),
      onCancel: () => finish(false),
    });
  });
}
