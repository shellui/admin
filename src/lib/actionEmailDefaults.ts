import type { ActionEmailDocument } from '@/features/actions/emailDocument';
import type { ActionEmailTemplate } from '@/features/actions/types';

export type ActionEmailLang = 'en' | 'fr';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}

export function isJsonContent(value: unknown): value is ActionEmailDocument {
  if (!isRecord(value)) return false;
  return value.type === 'doc' && Array.isArray(value.content);
}

export function hasDocumentContent(document: ActionEmailDocument | undefined): boolean {
  return Boolean(document?.content && document.content.length > 0);
}

export function defaultWelcomeEmailHtml(lang: ActionEmailLang): string {
  if (lang === 'fr') {
    return `
<h1>Bienvenue chez {{ envelope.company.name }}</h1>
<p>Bonjour {{ data.email }},</p>
<p>Merci de votre confiance. Voici un lien pour continuer.</p>
<p><a href="{{ magic_link_url }}">Continuer</a></p>
<p>À bientôt,<br/>L'équipe</p>
`.trim();
  }
  return `
<h1>Welcome to {{ envelope.company.name }}</h1>
<p>Hi {{ data.email }},</p>
<p>Thanks for joining us. Use the button below to get started.</p>
<p><a href="{{ magic_link_url }}">Get started</a></p>
<p>Thanks,<br/>The team</p>
`.trim();
}

export function resolveEmailEditorContent(
  template: ActionEmailTemplate,
  lang: ActionEmailLang,
): string | ActionEmailDocument {
  if (hasDocumentContent(template.document)) return template.document!;
  const html = template.html?.trim();
  if (html) return html;
  return defaultWelcomeEmailHtml(lang);
}

export function parseEmailDocumentJson(text: string): ActionEmailDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('Invalid JSON');
  }
  if (!isJsonContent(parsed)) {
    throw new Error('Document must be a TipTap doc with type "doc" and a content array');
  }
  return parsed;
}

export function normalizeEmailTemplate(
  raw: Partial<ActionEmailTemplate> | undefined,
  _lang: ActionEmailLang,
): ActionEmailTemplate {
  const subject = typeof raw?.subject === 'string' ? raw.subject : '';
  const legacyBodyHtml =
    raw && typeof (raw as { body_html?: string }).body_html === 'string'
      ? (raw as { body_html: string }).body_html
      : '';
  const html = typeof raw?.html === 'string' ? raw.html : legacyBodyHtml;
  const document = raw && isJsonContent(raw.document) ? raw.document : undefined;
  const theme_id = typeof raw?.theme_id === 'string' ? raw.theme_id : undefined;
  const base = { subject, html, ...(theme_id ? { theme_id } : {}) };
  if (hasDocumentContent(document) || html.trim()) {
    return { ...base, document };
  }
  return {
    ...base,
    document: undefined,
  };
}

export function emptyActionEmailTemplate(): ActionEmailTemplate {
  return { subject: '', html: '' };
}
