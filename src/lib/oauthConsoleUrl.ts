import type { OAuthConsoleUrlEntry } from '@/lib/oauthProviderCatalogTypes';

const PLACEHOLDER_PATTERN = /\{\{[^}]+\}\}/;

export function consoleUrlHasPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERN.test(value);
}

export function isConsoleUrlLinkable(entry: OAuthConsoleUrlEntry): boolean {
  const form = String(entry.form || '')
    .trim()
    .toLowerCase();
  if (form && form !== 'link') return false;
  const url = String(entry.url || '').trim();
  if (!url) return false;
  if (consoleUrlHasPlaceholder(url)) return false;
  return true;
}

export function consoleUrlHintText(entry: OAuthConsoleUrlEntry): string {
  const url = String(entry.url || entry.text || '').trim();
  const label = String(entry.label || '').trim();
  if (label && url) return `${label}: ${url}`;
  return url || label;
}
