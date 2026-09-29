import { afterEach, describe, expect, it, vi } from 'vitest';

const dialogMock = vi.fn();

vi.mock('@shellui/sdk', () => ({
  default: {
    dialog: (...args: unknown[]) => dialogMock(...args),
  },
}));

describe('confirmAction', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    dialogMock.mockReset();
  });

  it('uses window.confirm in a top-level window', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    vi.stubGlobal('parent', window);

    const { confirmAction } = await import('./confirmAction');
    const ok = await confirmAction({
      title: 'Delete item',
      description: 'This cannot be undone.',
      okLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    expect(ok).toBe(true);
    expect(confirm).toHaveBeenCalledWith('Delete item\n\nThis cannot be undone.');
    expect(dialogMock).not.toHaveBeenCalled();
  });

  it('uses shellui.dialog in an iframe and resolves true on ok', async () => {
    const parent = {} as Window;
    vi.stubGlobal('parent', parent);

    dialogMock.mockImplementation(({ onOk }: { onOk?: () => void }) => {
      onOk?.();
    });

    const { confirmAction } = await import('./confirmAction');
    const ok = await confirmAction({
      title: 'Revoke SCIM token',
      description: 'IdP sync with this token will stop.',
      okLabel: 'Revoke',
      cancelLabel: 'Cancel',
      danger: true,
    });

    expect(ok).toBe(true);
    expect(dialogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Revoke SCIM token',
        description: 'IdP sync with this token will stop.',
        mode: 'confirm',
        okLabel: 'Revoke',
        cancelLabel: 'Cancel',
        danger: true,
      }),
    );
  });

  it('uses shellui.dialog in an iframe and resolves false on cancel', async () => {
    const parent = {} as Window;
    vi.stubGlobal('parent', parent);

    dialogMock.mockImplementation(({ onCancel }: { onCancel?: () => void }) => {
      onCancel?.();
    });

    const { confirmAction } = await import('./confirmAction');
    const ok = await confirmAction({
      title: 'Delete rule',
      description: 'Deliveries in flight may still complete.',
      okLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    expect(ok).toBe(false);
    expect(dialogMock).toHaveBeenCalledTimes(1);
  });
});
