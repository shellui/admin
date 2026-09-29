import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(import.meta.dirname, '..');
const ALLOWED = new Set([path.join(SRC_ROOT, 'lib', 'confirmAction.ts')]);

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const name of entries) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(spec|test)\.(ts|tsx)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

describe('window.confirm guard', () => {
  it('is only used inside confirmAction helper', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_ROOT)) {
      if (ALLOWED.has(file)) continue;
      const text = readFileSync(file, 'utf8');
      if (/\bwindow\.confirm\s*\(/.test(text)) {
        offenders.push(path.relative(SRC_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
