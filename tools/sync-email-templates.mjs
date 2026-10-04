#!/usr/bin/env node
/**
 * Copies the email-service Tailwind templates into src/features/email/templates/vendor/
 * so the editor preview renders the same React Email tree the service sends.
 * Run: node tools/sync-email-templates.mjs [--check]
 * EMAIL_SERVICE_DIR overrides the sibling checkout (default ../email-service).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.resolve(
  process.env.EMAIL_SERVICE_DIR || path.join(ROOT, '..', 'email-service'),
  'renderer',
);
const OUT_DIR = path.join(ROOT, 'src/features/email/templates/vendor');
const FILES = [
  ['email.mjs', 'email.mjs'],
  ['themes/themes.json', 'themes.json'],
  ['themes/LICENSE', 'LICENSE'],
];

async function main() {
  const check = process.argv.includes('--check');
  const stale = [];
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const [from, to] of FILES) {
    const source = await fs.readFile(path.join(SOURCE, from), 'utf8');
    const target = path.join(OUT_DIR, to);
    const current = await fs.readFile(target, 'utf8').catch(() => null);
    if (current === source) continue;
    if (check) {
      stale.push(to);
      continue;
    }
    await fs.writeFile(target, source);
    console.log(`Updated ${path.relative(ROOT, target)}`);
  }
  if (stale.length) {
    console.error(`Out of date with ${SOURCE}: ${stale.join(', ')}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
