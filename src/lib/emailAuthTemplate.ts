import { EmailApiError } from '@/lib/emailApiErrors';
import type { EmailDocument, EmailVariable } from '@/lib/emailDocument';

/** Same placeholder shape as email-service `substitution.TOKEN_RE`. */
function tokenPattern(): RegExp {
  return /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*(?:\|\s*default\s*:\s*"([^"]*)"\s*)?\}\}/g;
}

const TAG_RE = /\{%|%\}|\{#|#\}/;

function findTokens(source: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of source.matchAll(tokenPattern())) {
    if (match[1]) tokens.add(match[1]);
  }
  return tokens;
}

function hasTemplateTags(source: string): boolean {
  return TAG_RE.test(source);
}

function isUrlVariable(variable: EmailVariable): boolean {
  return variable.type === 'url' || variable.isUrl;
}

function documentTokens(document: EmailDocument, subject: string, preheader: string): Set<string> {
  const blobs = [subject, preheader, JSON.stringify(document)];
  const tokens = new Set<string>();
  for (const blob of blobs) {
    if (hasTemplateTags(blob)) {
      throw new EmailApiError('validation_failed', 400, { document: ['template_tags_forbidden'] });
    }
    for (const token of findTokens(blob)) tokens.add(token);
  }
  return tokens;
}

function leftoverAfterTokens(href: string): string {
  return href.replace(tokenPattern(), '').trim();
}

function isHttpsAddress(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function requiredAuthLinkTokens(variables: EmailVariable[]): string[] {
  return variables
    .filter((variable) => variable.required && isUrlVariable(variable))
    .map((variable) => variable.token);
}

/**
 * Auth-lane overrides must keep required link variables.
 * A button href must be one of those variables (or another declared URL variable),
 * or an https address. The service still rejects hosts outside its allowlist.
 */
export function validateAuthLaneOverride(input: {
  laneClass: string;
  variables: EmailVariable[];
  subject: string;
  preheader: string;
  document: EmailDocument;
}): EmailApiError | null {
  if (input.laneClass !== 'auth') return null;
  let tokens: Set<string>;
  try {
    tokens = documentTokens(input.document, input.subject, input.preheader);
  } catch (error) {
    return error instanceof EmailApiError ? error : new EmailApiError('validation_failed', 400);
  }
  const missing = requiredAuthLinkTokens(input.variables).filter((token) => !tokens.has(token));
  if (missing.length) {
    const fieldErrors: Record<string, string[]> = {};
    for (const token of missing) fieldErrors[token] = ['required'];
    return new EmailApiError('auth_link_missing', 400, fieldErrors);
  }
  const allowed = new Set(input.variables.filter(isUrlVariable).map((variable) => variable.token));
  for (const block of input.document.blocks) {
    if (block.type !== 'button') continue;
    const href = block.href ?? '';
    if (hasTemplateTags(href)) {
      return new EmailApiError('validation_failed', 400, { document: ['template_tags_forbidden'] });
    }
    const hrefTokens = [...findTokens(href)];
    const unknown = hrefTokens.filter(
      (token) => !allowed.has(token) && !token.startsWith('system.'),
    );
    if (unknown.length) {
      return new EmailApiError('auth_link_host_not_allowed', 400, { href: ['token_not_allowed'] });
    }
    const leftover = leftoverAfterTokens(href);
    if (!hrefTokens.length && !leftover) {
      return new EmailApiError('auth_link_host_not_allowed', 400, { href: ['required'] });
    }
    if (leftover && !isHttpsAddress(leftover)) {
      return new EmailApiError('auth_link_host_not_allowed', 400, { href: ['host_not_allowed'] });
    }
  }
  return null;
}
