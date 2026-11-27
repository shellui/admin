import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  reconcileShellAccessToken,
  shellAccessTokenRefreshDue,
  useShelluiAccessToken,
} from '@/hooks/useShelluiAccessToken';
import { freshShellAccessToken, setLatestShellAccessToken } from '@/lib/shellAccessToken';
import { snapshotTrustedShellSettings } from '@/lib/trustedShellSettings';
import { addParentSettingsListener } from '@/lib/parentSettingsListener';
import {
  hydrateAuthBackendBaseUrlFromSdk,
  readExplicitAuthBackendBaseUrl,
  resetAuthBackendBaseUrlCache,
} from '@/lib/backendUrl';

const sdk = vi.hoisted(() => {
  const listeners: {
    type: string;
    fn: (message: { payload?: unknown }, event: MessageEvent) => void;
  }[] = [];
  return {
    listeners,
    sendMessageToParent: vi.fn(),
    expectedOrigin: null as string | null,
    initialSettings: {
      accessToken: null as string | null,
      user: { id: '1' } as { id: string } | null,
    } as {
      accessToken: string | null;
      user: { id: string } | null;
      authBackendBaseUrl?: string;
    },
  };
});

vi.mock('@shellui/sdk', () => ({
  default: {
    get initialSettings() {
      return sdk.initialSettings;
    },
  },
  addMessageListener: (
    type: string,
    fn: (message: { payload?: unknown }, event: MessageEvent) => void,
  ) => {
    const entry = { type, fn };
    sdk.listeners.push(entry);
    return () => {
      const index = sdk.listeners.indexOf(entry);
      if (index >= 0) sdk.listeners.splice(index, 1);
    };
  },
  resolveParentTargetOrigin: () => sdk.expectedOrigin,
  sendMessageToParent: (message: unknown) => {
    sdk.sendMessageToParent(message);
    return true;
  },
}));

function jwtWithExp(exp: number, claims: Record<string, unknown> = {}): string {
  const body = btoa(JSON.stringify({ ...claims, exp }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `h.${body}.s`;
}

function messageEvent(
  source: MessageEvent['source'],
  origin = window.location.origin,
): MessageEvent {
  return { source, origin } as MessageEvent;
}

function emit(
  type: string,
  settings: Record<string, unknown>,
  event: MessageEvent = messageEvent(window.parent),
) {
  for (const entry of sdk.listeners) {
    if (entry.type === type) entry.fn({ payload: { settings } }, event);
  }
}

const REQUEST = { type: 'SHELLUI_SETTINGS_REQUESTED', payload: {} };

describe('shellAccessTokenRefreshDue', () => {
  const now = 1_700_000_000;

  it('is due when the token is missing or exp is within 90s', () => {
    expect(shellAccessTokenRefreshDue(null, now)).toBe(true);
    expect(shellAccessTokenRefreshDue('', now)).toBe(true);
    expect(shellAccessTokenRefreshDue(jwtWithExp(now + 90), now)).toBe(true);
    expect(shellAccessTokenRefreshDue(jwtWithExp(now + 91), now)).toBe(false);
    expect(shellAccessTokenRefreshDue('opaque-token', now)).toBe(false);
  });
});

describe('reconcileShellAccessToken', () => {
  it('keeps the previous token until a payload with user null', () => {
    const prev = 'previous-token';
    expect(reconcileShellAccessToken(prev, { user: { id: '1' } } as never)).toBe(prev);
    expect(reconcileShellAccessToken(prev, { user: null } as never)).toBeNull();
    expect(
      reconcileShellAccessToken(prev, { user: { id: '1' }, accessToken: 'next' } as never),
    ).toBe('next');
  });
});

describe('useShelluiAccessToken', () => {
  function seed(settings: typeof sdk.initialSettings) {
    sdk.initialSettings = settings;
    snapshotTrustedShellSettings(settings);
    setLatestShellAccessToken(null);
  }

  beforeEach(() => {
    sdk.listeners.splice(0, sdk.listeners.length);
    sdk.sendMessageToParent.mockClear();
    sdk.expectedOrigin = window.location.origin;
    seed({ accessToken: jwtWithExp(Date.now() / 1000 + 3600), user: { id: '1' } });
  });

  afterEach(() => {
    cleanup();
  });

  it('posts SHELLUI_SETTINGS_REQUESTED once after subscribing', () => {
    renderHook(() => useShelluiAccessToken());
    expect(sdk.listeners.map((entry) => entry.type).sort()).toEqual([
      'SHELLUI_SETTINGS',
      'SHELLUI_SETTINGS_UPDATED',
    ]);
    expect(sdk.sendMessageToParent).toHaveBeenCalledTimes(1);
    expect(sdk.sendMessageToParent).toHaveBeenCalledWith(REQUEST);
  });

  it('asks again on show when the token is missing or exp is within 90s', () => {
    seed({ accessToken: null, user: null });
    const { result, rerender } = renderHook(() => useShelluiAccessToken());
    sdk.sendMessageToParent.mockClear();

    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pageshow'));
    expect(sdk.sendMessageToParent).toHaveBeenCalledTimes(3);

    act(() => {
      emit('SHELLUI_SETTINGS', {
        user: { id: '1' },
        accessToken: jwtWithExp(Date.now() / 1000 + 30),
      });
    });
    rerender();
    sdk.sendMessageToParent.mockClear();
    window.dispatchEvent(new Event('focus'));
    expect(sdk.sendMessageToParent).toHaveBeenCalledTimes(1);
    expect(result.current).toContain('.');
  });

  it('does not ask again when the token expires later than 90s', () => {
    renderHook(() => useShelluiAccessToken());
    sdk.sendMessageToParent.mockClear();
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pageshow'));
    expect(sdk.sendMessageToParent).not.toHaveBeenCalled();
  });

  it('sends the renewed token after a resume request without a new hook value', () => {
    const stale = jwtWithExp(Date.now() / 1000 + 30, { sub: '1', company_id: 7 });
    seed({ accessToken: stale, user: { id: '1' } });
    const { result } = renderHook(() => useShelluiAccessToken());
    expect(result.current).toBe(stale);

    const fresh = jwtWithExp(Date.now() / 1000 + 3600, { sub: '1', company_id: 7 });
    act(() => {
      window.dispatchEvent(new Event('focus'));
      emit('SHELLUI_SETTINGS', { user: { id: '1' }, accessToken: fresh });
    });
    expect(sdk.sendMessageToParent).toHaveBeenCalledWith(REQUEST);
    expect(result.current).toBe(stale);
    expect(freshShellAccessToken(stale)).toBe(fresh);

    // The newest token is not due, so a later focus does not ask again.
    sdk.sendMessageToParent.mockClear();
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(sdk.sendMessageToParent).not.toHaveBeenCalled();
  });

  it('does not re-render consumers on a renewal for the same session', () => {
    const first = jwtWithExp(Date.now() / 1000 + 300, { sub: '1', company_id: 7, iat: 1 });
    seed({ accessToken: first, user: { id: '1' } });
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useShelluiAccessToken();
    });
    const before = renders;

    for (let i = 0; i < 3; i += 1) {
      const renewed = jwtWithExp(Date.now() / 1000 + 600 + i, {
        sub: '1',
        company_id: 7,
        iat: 2 + i,
      });
      act(() => {
        emit('SHELLUI_SETTINGS_UPDATED', { user: { id: '1' }, accessToken: renewed });
      });
      expect(freshShellAccessToken(first)).toBe(renewed);
    }
    expect(result.current).toBe(first);
    expect(renders).toBe(before);
  });

  it('changes the value when the user, company or roles change', () => {
    const first = jwtWithExp(Date.now() / 1000 + 300, { sub: '1', company_id: 7 });
    seed({ accessToken: first, user: { id: '1' } });
    const { result } = renderHook(() => useShelluiAccessToken());

    const otherCompany = jwtWithExp(Date.now() / 1000 + 300, { sub: '1', company_id: 8 });
    act(() => {
      emit('SHELLUI_SETTINGS_UPDATED', { user: { id: '1' }, accessToken: otherCompany });
    });
    expect(result.current).toBe(otherCompany);
    expect(freshShellAccessToken(first)).toBe(first);

    const owner = jwtWithExp(Date.now() / 1000 + 300, {
      sub: '1',
      company_id: 8,
      is_company_owner: true,
    });
    act(() => {
      emit('SHELLUI_SETTINGS_UPDATED', { user: { id: '1' }, accessToken: owner });
    });
    expect(result.current).toBe(owner);
  });

  it('applies settings from the parent window at the expected origin', () => {
    const current = jwtWithExp(Date.now() / 1000 + 3600, { sub: '1', company_id: 7 });
    seed({ accessToken: current, user: { id: '1' } });
    const { result } = renderHook(() => useShelluiAccessToken());
    const otherIdentity = jwtWithExp(Date.now() / 1000 + 3600, { sub: '2', company_id: 9 });
    const sameSession = jwtWithExp(Date.now() / 1000 + 7200, {
      sub: '1',
      company_id: 7,
      iat: 9,
    });
    const nested = {} as Window;

    act(() => {
      emit(
        'SHELLUI_SETTINGS',
        { user: { id: '1' }, accessToken: sameSession },
        messageEvent(nested),
      );
      emit(
        'SHELLUI_SETTINGS_UPDATED',
        { user: { id: '2' }, accessToken: otherIdentity },
        messageEvent(window.parent, 'https://other.example'),
      );
      emit('SHELLUI_SETTINGS', { user: null }, messageEvent(null));
    });
    expect(result.current).toBe(current);
    expect(freshShellAccessToken(current)).toBe(current);

    sdk.expectedOrigin = null;
    act(() => {
      emit('SHELLUI_SETTINGS_UPDATED', { user: { id: '2' }, accessToken: otherIdentity });
    });
    expect(result.current).toBe(current);
    expect(freshShellAccessToken(current)).toBe(current);

    sdk.expectedOrigin = window.location.origin;
    act(() => {
      emit('SHELLUI_SETTINGS', { user: { id: '1' }, accessToken: sameSession });
    });
    expect(result.current).toBe(current);
    expect(freshShellAccessToken(current)).toBe(sameSession);

    act(() => {
      emit('SHELLUI_SETTINGS_UPDATED', { user: { id: '2' }, accessToken: otherIdentity });
    });
    expect(result.current).toBe(otherIdentity);
  });

  it('keeps an omitted access token while user is set, then clears on user null', () => {
    const token = jwtWithExp(Date.now() / 1000 + 3600);
    seed({ accessToken: token, user: { id: '1' } });
    const { result } = renderHook(() => useShelluiAccessToken());

    act(() => {
      emit('SHELLUI_SETTINGS', { user: { id: '1' } });
    });
    expect(result.current).toBe(token);

    act(() => {
      emit('SHELLUI_SETTINGS_UPDATED', { user: null });
    });
    expect(result.current).toBeNull();
  });

  it('keeps the token and identity URL when live initialSettings are poisoned after hydrate', () => {
    const good = jwtWithExp(Date.now() / 1000 + 3600, { sub: 'user-1' });
    seed({
      accessToken: good,
      authBackendBaseUrl: 'https://id.example',
      user: { id: '1' },
    });
    hydrateAuthBackendBaseUrlFromSdk();
    // A child frame overwrote the live object. The hook must not reread it.
    sdk.initialSettings = {
      accessToken: jwtWithExp(Date.now() / 1000 + 3600, { sub: 'attacker' }),
      authBackendBaseUrl: 'https://evil.example',
      user: { id: 'attacker' },
    };
    const { result } = renderHook(() => useShelluiAccessToken());
    expect(result.current).toBe(good);
    expect(readExplicitAuthBackendBaseUrl()).toBe('https://id.example');
  });

  it('reads the identity URL from the snapshot when the shell-message cache is empty', () => {
    seed({
      accessToken: jwtWithExp(Date.now() / 1000 + 3600, { sub: 'user-1' }),
      authBackendBaseUrl: 'https://id.example',
      user: { id: '1' },
    });
    resetAuthBackendBaseUrlCache();
    sdk.initialSettings = {
      accessToken: jwtWithExp(Date.now() / 1000 + 3600, { sub: 'attacker' }),
      authBackendBaseUrl: 'https://evil.example',
      user: { id: 'attacker' },
    };
    expect(readExplicitAuthBackendBaseUrl()).toBe('https://id.example');
  });

  it('uses a parent refresh that arrived while no hook was mounted', () => {
    const first = jwtWithExp(Date.now() / 1000 + 60, { sub: '1', company_id: 7 });
    const renewed = jwtWithExp(Date.now() / 1000 + 3600, { sub: '1', company_id: 7 });
    seed({ accessToken: first, user: { id: '1' } });
    const { result, unmount } = renderHook(() => useShelluiAccessToken());
    expect(result.current).toBe(first);
    unmount();

    const off = addParentSettingsListener(() => {});
    act(() => {
      emit('SHELLUI_SETTINGS_UPDATED', { user: { id: '1' }, accessToken: renewed });
    });
    off();

    const { result: remounted } = renderHook(() => useShelluiAccessToken());
    expect(remounted.current).toBe(renewed);
  });

  it('clears the token after a logout that arrived while no hook was mounted', () => {
    const token = jwtWithExp(Date.now() / 1000 + 3600, { sub: '1' });
    seed({ accessToken: token, user: { id: '1' } });
    const { unmount } = renderHook(() => useShelluiAccessToken());
    unmount();

    const off = addParentSettingsListener(() => {});
    act(() => {
      emit('SHELLUI_SETTINGS', { user: null });
    });
    off();

    const { result } = renderHook(() => useShelluiAccessToken());
    expect(result.current).toBeNull();
  });
});
