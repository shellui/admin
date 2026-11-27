import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const lockfile = readFileSync(path.resolve(__dirname, '../../pnpm-lock.yaml'), 'utf8');

/** Versions of a package resolved in the `packages:` section of pnpm-lock.yaml. */
function resolvedVersions(name: string): string[] {
  const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const pattern = new RegExp(`^ {2}'?${escaped}@([^'(:]+)[^']*'?:`, 'gm');
  const versions = new Set<string>();
  for (const match of lockfile.matchAll(pattern)) versions.add(match[1]);
  return [...versions].sort();
}

describe('dependency hygiene', () => {
  it('resolves exactly one @tiptap/core and one @tiptap/pm', () => {
    // Two copies of the editor core break ProseMirror plugin identity at runtime.
    expect(resolvedVersions('@tiptap/core')).toHaveLength(1);
    expect(resolvedVersions('@tiptap/pm')).toHaveLength(1);
  });

  it('finds the packages it checks (guards against a lockfile format change)', () => {
    expect(resolvedVersions('@tiptap/core').length).toBeGreaterThan(0);
  });
});
