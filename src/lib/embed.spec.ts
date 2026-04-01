import { describe, it, expect } from 'vitest';
import { isEmbeddedInShell } from './embed';

describe('isEmbeddedInShell', () => {
  it('returns false in a top-level window (e.g. Vitest / direct tab)', () => {
    expect(isEmbeddedInShell()).toBe(false);
  });
});
