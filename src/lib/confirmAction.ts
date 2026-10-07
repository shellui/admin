import shellui from '@shellui/sdk';

export type ConfirmActionOptions = {
  title: string;
  description: string;
  okLabel: string;
  cancelLabel: string;
  /** Destructive confirm (passed to Shellui dialog when the host supports it). */
  danger?: boolean;
};

function isTopLevelWindow(): boolean {
  return typeof window === 'undefined' || window.parent === window;
}

function nativeConfirmMessage(options: ConfirmActionOptions): string {
  const { title, description } = options;
  if (!description.trim()) return title;
  if (!title.trim()) return description;
  return `${title}\n\n${description}`;
}

/**
 * Confirms a destructive or irreversible action. Uses `window.confirm` in a top-level
 * window; in the Shellui admin iframe uses `shellui.dialog` (native confirm is blocked).
 */
export async function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  if (isTopLevelWindow()) {
    return window.confirm(nativeConfirmMessage(options));
  }

  const { title, description, okLabel, cancelLabel, danger } = options;

  return await new Promise<boolean>((resolve) => {
    shellui.dialog({
      title,
      description,
      mode: 'confirm',
      okLabel,
      cancelLabel,
      ...(danger ? ({ danger: true } as Record<string, unknown>) : {}),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
