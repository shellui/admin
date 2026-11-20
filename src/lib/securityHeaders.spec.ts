import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const confPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../docker/security-headers.conf',
);

describe('security-headers.conf', () => {
  it('sends script-src, object-src, and base-uri', () => {
    const conf = readFileSync(confPath, 'utf8');
    expect(conf).toContain(
      `add_header Content-Security-Policy "script-src 'self'; object-src 'none'; base-uri 'none'" always;`,
    );
  });
});
