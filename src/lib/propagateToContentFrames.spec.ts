import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const addMessageListener = vi.fn();
const propagateMessage = vi.fn();

vi.mock('@shellui/sdk', () => ({
  default: {
    addMessageListener,
    propagateMessage,
  },
}));

vi.mock('@/lib/embed', () => ({
  isAdminContentFrame: vi.fn(),
}));

describe('setupContentFrameMessagePropagation', () => {
  beforeEach(() => {
    vi.resetModules();
    addMessageListener.mockReset();
    propagateMessage.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers settings listeners in chrome mode and forwards via propagateMessage', async () => {
    const { isAdminContentFrame } = await import('@/lib/embed');
    vi.mocked(isAdminContentFrame).mockReturnValue(false);
    vi.stubGlobal('parent', { location: { origin: 'https://shell.example' } });

    const { setupContentFrameMessagePropagation } = await import('./propagateToContentFrames');
    setupContentFrameMessagePropagation();

    expect(addMessageListener).toHaveBeenCalledTimes(2);
    expect(addMessageListener).toHaveBeenCalledWith('SHELLUI_SETTINGS', expect.any(Function));
    expect(addMessageListener).toHaveBeenCalledWith(
      'SHELLUI_SETTINGS_UPDATED',
      expect.any(Function),
    );

    const forward = addMessageListener.mock.calls[0][1] as (message: {
      type: string;
      payload: unknown;
    }) => void;
    forward({ type: 'SHELLUI_SETTINGS', payload: { settings: { appearance: { mode: 'dark' } } } });

    expect(propagateMessage).toHaveBeenCalledWith({
      type: 'SHELLUI_SETTINGS',
      payload: { settings: { appearance: { mode: 'dark' } } },
    });
  });

  it('does nothing in content (nested same-origin) frames', async () => {
    const { isAdminContentFrame } = await import('@/lib/embed');
    vi.mocked(isAdminContentFrame).mockReturnValue(true);
    vi.stubGlobal('parent', { location: { origin: window.location.origin } });

    const { setupContentFrameMessagePropagation } = await import('./propagateToContentFrames');
    setupContentFrameMessagePropagation();

    expect(addMessageListener).not.toHaveBeenCalled();
  });

  it('does nothing when not embedded (top-level window)', async () => {
    const { isAdminContentFrame } = await import('@/lib/embed');
    vi.mocked(isAdminContentFrame).mockReturnValue(false);

    const { setupContentFrameMessagePropagation } = await import('./propagateToContentFrames');
    setupContentFrameMessagePropagation();

    expect(addMessageListener).not.toHaveBeenCalled();
  });
});
