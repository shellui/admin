import type { OAuthConsoleUrlEntry, OAuthConsoleUrlKind } from '@/lib/oauthProviderCatalogTypes';

const VALID_KINDS = new Set<OAuthConsoleUrlKind>([
  'app_registration',
  'developer_console',
  'app_settings',
  'docs',
  'other',
]);

const PLACEHOLDER_PATTERN = /\{\{[^}]+\}\}/g;
const URL_IN_PARENS = /\((https?:\/\/[^)\s]+)\)/gi;

/** Pull an HTTPS URL from legacy catalog copy such as "Label (https://…)". */
export function extractConsoleUrlFromLegacyCopy(...parts: string[]): string {
  const combined = parts
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(' ');
  if (!combined) return '';
  const direct = parts.find((p) => /^https?:\/\//i.test(String(p || '').trim()));
  if (direct) return String(direct).trim();
  const parenMatches = [...combined.matchAll(URL_IN_PARENS)];
  if (parenMatches.length > 0) {
    return parenMatches[parenMatches.length - 1][1].trim();
  }
  const inline = combined.match(/https?:\/\/[^\s)]+/i);
  return inline ? inline[0].trim() : combined;
}

export function inferConsoleUrlKind(raw: Record<string, unknown>): OAuthConsoleUrlKind {
  const kind = String(raw.kind || '')
    .trim()
    .toLowerCase();
  if (VALID_KINDS.has(kind as OAuthConsoleUrlKind)) {
    return kind as OAuthConsoleUrlKind;
  }
  const label = String(raw.label || raw.text || '').toLowerCase();
  if (label.includes('registration') || label.includes('register')) return 'app_registration';
  if (label.includes('developer') || label.includes('dev portal')) return 'developer_console';
  if (label.includes('setting')) return 'app_settings';
  if (label.includes('doc')) return 'docs';
  return 'other';
}

export function consoleUrlPlaceholders(url: string, explicit?: string[]): string[] {
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.map((p) => String(p).trim()).filter(Boolean);
  }
  const found: string[] = [];
  for (const match of url.matchAll(PLACEHOLDER_PATTERN)) {
    found.push(match[0]);
  }
  return found;
}

export function consoleUrlHasPlaceholder(url: string): boolean {
  return PLACEHOLDER_PATTERN.test(url);
}

export type ConsoleUrlPresentation = 'link' | 'template' | 'hidden';

export function consoleUrlPresentation(entry: OAuthConsoleUrlEntry): ConsoleUrlPresentation {
  const form = String(entry.form || 'link')
    .trim()
    .toLowerCase();
  const url = String(entry.url || '').trim();
  if (!url) return 'hidden';
  if (form === 'template' || consoleUrlHasPlaceholder(url)) return 'template';
  if (form !== 'link' && form !== '') return 'hidden';
  if (!/^https?:\/\//i.test(url)) return 'hidden';
  return 'link';
}

export function consoleKindI18nKey(kind: OAuthConsoleUrlKind): string {
  return `oauthConsoleKind_${kind}`;
}

export type ConsoleUrlSegment =
  | { type: 'text'; value: string }
  | { type: 'placeholder'; value: string };

export function splitConsoleUrlTemplate(url: string): ConsoleUrlSegment[] {
  const segments: ConsoleUrlSegment[] = [];
  let lastIndex = 0;
  for (const match of url.matchAll(PLACEHOLDER_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', value: url.slice(lastIndex, index) });
    }
    segments.push({ type: 'placeholder', value: match[0] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < url.length) {
    segments.push({ type: 'text', value: url.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: 'text', value: url }];
}
