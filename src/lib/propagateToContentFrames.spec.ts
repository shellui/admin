import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ContentFrameAuthRule } from '@/lib/contentFrameAuth';

const addMessageListener = vi.fn();
const propagateMessage = vi.fn();
const sendMessage = vi.fn();
const getLiveIframes = vi.fn();

vi.mock('@shellui/sdk', () => ({
  default: {
    addMessageListener,
    propagateMessage,
    sendMessage,
    frameRegistry: {
      getLiveIframes,
    },
  },
}));

vi.mock('@/lib/embed', () => ({
  isAdminContentFrame: vi.fn(),
}));

function iframe(src: string): HTMLIFrameElement {
  return { src } as HTMLIFrameElement;
}

const settings = {
  accessToken: 'owner-token',
  user: { id: '1' },
  appearance: { mode: 'dark' },
};

const RULES: ContentFrameAuthRule[] = [
  { url: 'https://files.example/', safeForAuthToken: true },
  { url: 'https://id.example/api/docs/', safeForAuthToken: true, ignoreMessages: true },
  { url: 'https://id.example/api/docs/redoc/', ignoreMessages: true },
  { url: 'https://billing.example/', safeForAuthToken: true },
];

describe('setupContentFrameMessagePropagation', () => {
  beforeEach(() => {
    vi.resetModules();
    addMessageListener.mockReset();
    propagateMessage.mockReset();
    sendMessage.mockReset();
    getLiveIframes.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function forwardInChrome(message: {
    type: string;
    payload: unknown;
    to?: string[];
  }): Promise<void> {
    const { setContentFrameAuthRules } = await import('@/lib/contentFrameAuth');
    setContentFrameAuthRules(RULES);
    const { isAdminContentFrame } = await import('@/lib/embed');
    vi.mocked(isAdminContentFrame).mockReturnValue(false);
    vi.stubGlobal('parent', { location: { origin: 'https://shell.example' } });

    const { setupContentFrameMessagePropagation } = await import('./propagateToContentFrames');
    setupContentFrameMessagePropagation();
    const forward = addMessageListener.mock.calls[0][1] as (message: {
      type: string;
      payload: unknown;
      to?: string[];
    }) => void;
    forward(message);
  }

  it('registers settings listeners in chrome mode and forwards via sendMessage', async () => {
    getLiveIframes.mockReturnValue([['admin', iframe(`${window.location.origin}/#/users`)]]);
    await forwardInChrome({
      type: 'SHELLUI_SETTINGS',
      payload: { settings: { appearance: { mode: 'dark' } } },
    });

    expect(addMessageListener).toHaveBeenCalledTimes(2);
    expect(addMessageListener).toHaveBeenCalledWith('SHELLUI_SETTINGS', expect.any(Function));
    expect(addMessageListener).toHaveBeenCalledWith(
      'SHELLUI_SETTINGS_UPDATED',
      expect.any(Function),
    );
    expect(propagateMessage).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'SHELLUI_SETTINGS',
      payload: { settings: { appearance: { mode: 'dark' } } },
      to: ['admin'],
    });
  });

  it('strips accessToken except for same-origin admin, files, Swagger, and safeForAuthToken URLs', async () => {
    getLiveIframes.mockReturnValue([
      ['admin', iframe(`${window.location.origin}/#/users`)],
      ['files', iframe('https://files.example/company')],
      ['swagger', iframe('https://id.example/api/docs/')],
      ['redoc', iframe('https://id.example/api/docs/redoc/')],
      ['billing', iframe('https://billing.example/#/')],
      ['custom', iframe('https://custom.example/#/')],
    ]);
    const payload = { settings: { ...settings } };
    const message = { type: 'SHELLUI_SETTINGS', payload, to: ['custom', 'redoc'] };
    await forwardInChrome(message);

    expect(message.to).toEqual([]);
    expect(payload.settings.accessToken).toBe('owner-token');
    expect(propagateMessage).not.toHaveBeenCalled();

    const sent = sendMessage.mock.calls.map(
      (call) =>
        call[0] as {
          to: string[];
          payload: { settings: { accessToken: string | null; appearance: { mode: string } } };
        },
    );
    const byUuid = Object.fromEntries(sent.map((entry) => [entry.to[0], entry.payload.settings]));

    expect(byUuid.admin.accessToken).toBe('owner-token');
    expect(byUuid.files.accessToken).toBe('owner-token');
    expect(byUuid.swagger.accessToken).toBe('owner-token');
    expect(byUuid.billing.accessToken).toBe('owner-token');
    expect(byUuid.custom.accessToken).toBeNull();
    expect(byUuid.custom.appearance).toEqual({ mode: 'dark' });
    expect(byUuid.redoc.accessToken).toBeNull();
    expect(sent.map((entry) => entry.to[0]).sort()).toEqual([
      'admin',
      'billing',
      'custom',
      'files',
      'redoc',
      'swagger',
    ]);
  });

  it('does not fan settings out to ReDoc unless the reply is addressed to that frame', async () => {
    getLiveIframes.mockReturnValue([['redoc', iframe('https://id.example/api/docs/redoc/')]]);
    await forwardInChrome({
      type: 'SHELLUI_SETTINGS_UPDATED',
      payload: { settings },
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('forwards logout (user null) without restoring a stripped token', async () => {
    getLiveIframes.mockReturnValue([
      ['admin', iframe(`${window.location.origin}/#/`)],
      ['custom', iframe('https://custom.example/')],
    ]);
    await forwardInChrome({
      type: 'SHELLUI_SETTINGS_UPDATED',
      payload: { settings: { user: null, accessToken: null, appearance: { mode: 'light' } } },
    });
    const payloads = sendMessage.mock.calls.map(
      (call) =>
        (
          call[0] as {
            payload: { settings: { user: null; accessToken: null } };
          }
        ).payload.settings,
    );
    expect(payloads).toEqual([
      { user: null, accessToken: null, appearance: { mode: 'light' } },
      { user: null, accessToken: null, appearance: { mode: 'light' } },
    ]);
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
