import { describe, expect, it } from 'vitest';
import { inferConsoleUrlKind } from '@/lib/oauthConsoleUrlKind';

describe('inferConsoleUrlKind', () => {
  it('prefers explicit kind from API', () => {
    expect(inferConsoleUrlKind({ kind: 'docs', label: 'ignored', url: 'https://x' })).toBe('docs');
  });
});
