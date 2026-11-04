import { afterEach, describe, expect, it, vi } from 'vitest';
import { readDevServiceUrlFromEnv } from '@/lib/devServiceUrl';

describe('readDevServiceUrlFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('normalizes a URL in dev', () => {
    expect(readDevServiceUrlFromEnv('http://localhost:8002/')).toBe('http://localhost:8002');
  });

  it('returns null for empty values in dev', () => {
    expect(readDevServiceUrlFromEnv(undefined)).toBeNull();
    expect(readDevServiceUrlFromEnv('  ')).toBeNull();
  });
});
