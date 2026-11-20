import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

function isAtLeast(version: string, minimum: string): boolean {
  const left = version.split('.').map((part) => Number.parseInt(part, 10));
  const right = minimum.split('.').map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < 3; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

describe('vite', () => {
  it('is 6.4.4 or newer', () => {
    const { version } = require('vite/package.json') as { version: string };
    expect(isAtLeast(version, '6.4.4')).toBe(true);
  });
});
