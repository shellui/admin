import { describe, it, expect, vi, afterEach } from 'vitest';
import { isEmbeddedInShell, isAdminContentFrame } from './embed';

describe('isEmbeddedInShell', () => {
  it('returns false in a top-level window (e.g. Vitest / direct tab)', () => {
    expect(isEmbeddedInShell()).toBe(false);
  });
});

describe('isAdminContentFrame', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false in a top-level window', () => {
    expect(isAdminContentFrame()).toBe(false);
  });

  it('returns true when parent is same-origin', () => {
    const parent = {
      location: { origin: window.location.origin },
    };
    vi.stubGlobal('parent', parent);
    expect(isAdminContentFrame()).toBe(true);
  });

  it('returns false when parent origin access throws (cross-origin shell)', () => {
    const parent = {
      get location() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    };
    vi.stubGlobal('parent', parent);
    expect(isAdminContentFrame()).toBe(false);
  });
});
