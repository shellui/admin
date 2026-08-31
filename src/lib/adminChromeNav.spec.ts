import { describe, it, expect, afterEach, vi } from 'vitest';
import { getAdminHashPath, readSidebarCollapsed, writeSidebarCollapsed } from './adminChromeNav';

describe('getAdminHashPath', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('returns / for empty hash', () => {
    window.location.hash = '';
    expect(getAdminHashPath()).toBe('/');
  });

  it('strips query from hash path', () => {
    window.location.hash = '#/users?page=2';
    expect(getAdminHashPath()).toBe('/users');
  });

  it('normalizes trailing slashes', () => {
    window.location.hash = '#/groups/';
    expect(getAdminHashPath()).toBe('/groups');
  });
});

describe('sidebar collapsed persistence', () => {
  const store = new Map<string, string>();

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it('round-trips collapsed flag', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });

    expect(readSidebarCollapsed()).toBe(false);
    writeSidebarCollapsed(true);
    expect(readSidebarCollapsed()).toBe(true);
    writeSidebarCollapsed(false);
    expect(readSidebarCollapsed()).toBe(false);
  });
});
