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

/**
 * React Email persists panel styles into a `globalContent` node. Those embedded
 * styles win over a new `theme` prop on remount (seed only runs when styles are
 * absent). Strip them so Shellui theme_id / theme prop can re-seed cleanly when
 * the user changes the theme picker.
 */
export function stripEmbeddedEmailThemeStyles(
  content: string | ActionEmailDocument,
): string | ActionEmailDocument {
  if (typeof content === 'string') return content;
  return stripEmbeddedThemeFromNode(content) as ActionEmailDocument;
}

function stripEmbeddedThemeFromNode(node: ActionEmailDocument): ActionEmailDocument {
  let next: ActionEmailDocument = node;

  if (node.type === 'globalContent' && isRecord(node.attrs)) {
    const data = node.attrs.data;
    if (isRecord(data) && ('styles' in data || 'theme' in data || 'css' in data)) {
      const { styles: _styles, theme: _theme, css: _css, ...rest } = data;
      next = {
        ...node,
        attrs: {
          ...node.attrs,
          data: rest,
        },
      };
    }
  }

  if (!Array.isArray(node.content) || node.content.length === 0) {
    return next;
  }

  let childChanged = false;
  const content = node.content.map((child) => {
    const stripped = stripEmbeddedThemeFromNode(child);
    if (stripped !== child) childChanged = true;
    return stripped;
  });

  if (!childChanged && next === node) return node;
  return { ...next, content };
}

export function defaultWelcomeEmailHtml(lang: ActionEmailLang): string {
  if (lang === 'fr') {
    return `
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f5;border-collapse:collapse;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;background-color:#ffffff;border-radius:8px;border-collapse:separate;">
      <tr><td style="padding:40px 40px 64px;text-align:center;">
        <h1 style="margin:0 0 24px;font-size:28px;font-weight:600;color:#18181b;">Bienvenue chez {{ envelope.company.name }}</h1>
        <p style="margin:0 0 24px;font-size:16px;color:#52525b;">Bonjour {{ data.email }},</p>
        <p style="margin:0 0 24px;font-size:16px;color:#52525b;">Merci de votre confiance. Voici un lien pour continuer.</p>
        <a href="{{ magic_link_url }}" style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;padding:16px 28px;border-radius:8px;font-weight:500;font-size:16px;">Continuer</a>
      </td></tr>
    </table>
  </td></tr>
</table>
`.trim();
  }
  return `
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f5;border-collapse:collapse;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;background-color:#ffffff;border-radius:8px;border-collapse:separate;">
      <tr><td style="padding:40px 40px 64px;text-align:center;">
        <h1 style="margin:0 0 24px;font-size:28px;font-weight:600;color:#18181b;">Welcome to {{ envelope.company.name }}</h1>
        <p style="margin:0 0 24px;font-size:16px;color:#52525b;">Hi {{ data.email }},</p>
        <p style="margin:0 0 24px;font-size:16px;color:#52525b;">Thanks for joining us. Use the button below to get started.</p>
        <a href="{{ magic_link_url }}" style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;padding:16px 28px;border-radius:8px;font-weight:500;font-size:16px;">Get started</a>
      </td></tr>
    </table>
  </td></tr>
</table>
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
