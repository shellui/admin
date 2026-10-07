import { EmailApiError } from '@/lib/emailApiErrors';
import {
  documentLinks,
  documentTexts,
  emailTokenPattern as tokenPattern,
  type EmailDocument,
  type EmailVariable,
} from '@/lib/emailDocument';

const TAG_RE = /\{%|%\}|\{#|#\}/;
/** Same as email-service `_AUTH_SYSTEM_LINKS`: auth mail has no unsubscribe page. */
const AUTH_SYSTEM_LINKS = new Set(['system.message_id']);

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

function httpsHost(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname) return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Same shape as email-service `_LITERAL_LINK`, without the required link variable. */
const LITERAL_LINK =
  /(?:\b(?:https?:\/\/|mailto:|tel:)[^\s<>"']+|www\.[^\s<>"']+|<\s*a\b|\bhref\s*=)/i;

function withoutRequiredTokens(text: string, allowed: Set<string>): string {
  return text.replace(tokenPattern(), (full, token: string) => (allowed.has(token) ? '' : full));
}

export function requiredAuthLinkTokens(variables: EmailVariable[]): string[] {
  return variables
    .filter((variable) => variable.required && isUrlVariable(variable))
    .map((variable) => variable.token);
}

/**
 * Same checks as email-service `validate_auth_template`. Every link must be a
 * declared URL variable, or an https address on `authLinkHosts` when that list
 * is known. Subject, preheader, and body text reject a literal URL.
 */
export function validateAuthLaneOverride(input: {
  laneClass: string;
  variables: EmailVariable[];
  authLinkHosts?: string[];
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
  const allowed = new Set([
    ...input.variables.filter(isUrlVariable).map((variable) => variable.token),
    ...AUTH_SYSTEM_LINKS,
  ]);
  const allowedHosts = (input.authLinkHosts ?? []).map((item) => item.toLowerCase());
  for (const href of documentLinks(input.document)) {
    const issue = linkIssue(href, allowed, allowedHosts);
    if (issue) return issue;
  }
  const required = new Set(requiredAuthLinkTokens(input.variables));
  const prose: Array<[string, string]> = [
    ['subject', input.subject],
    ['preheader', input.preheader],
  ];
  for (const [field, value] of prose) {
    if (LITERAL_LINK.test(withoutRequiredTokens(value, required))) {
      return new EmailApiError('auth_literal_link', 400, { [field]: ['literal_url'] });
    }
  }
  for (const text of documentTexts(input.document)) {
    if (LITERAL_LINK.test(withoutRequiredTokens(text, required))) {
      return new EmailApiError('auth_literal_link', 400, { document: ['literal_url'] });
    }
  }
  return null;
}

function linkIssue(
  href: string,
  allowed: Set<string>,
  allowedHosts: string[],
): EmailApiError | null {
  if (hasTemplateTags(href)) {
    return new EmailApiError('validation_failed', 400, { document: ['template_tags_forbidden'] });
  }
  const hrefTokens = [...findTokens(href)];
  if (hrefTokens.some((token) => !allowed.has(token))) {
    return new EmailApiError('auth_link_host_not_allowed', 400, { href: ['token_not_allowed'] });
  }
  const leftover = href.replace(tokenPattern(), '').trim();
  if (!hrefTokens.length && !leftover) {
    return new EmailApiError('auth_link_host_not_allowed', 400, { href: ['required'] });
  }
  if (leftover) {
    const host = httpsHost(leftover);
    if (!host || (allowedHosts.length > 0 && !allowedHosts.includes(host))) {
      return new EmailApiError('auth_link_host_not_allowed', 400, { href: ['host_not_allowed'] });
    }
  }
  return null;
}
