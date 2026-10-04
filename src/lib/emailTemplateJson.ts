import { isEmailDocument, type EmailDocument } from '@/lib/emailDocument';

/** Copy and paste format: the inbox lines plus the editor JSON. */
export type EmailTemplateJson = {
  /** Omitted keeps the current subject. */
  subject?: string;
  /** Omitted keeps the current preheader. */
  preheader?: string;
  document: EmailDocument;
};

export type EmailTemplateJsonError =
  | { code: 'invalid_json' }
  | { code: 'not_object' }
  | { code: 'invalid_field'; field: string };

export function templateJsonText(value: EmailTemplateJson): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Accepts the full object or a bare `{ "type": "doc", … }` document. */
export function parseTemplateJson(
  text: string,
): { ok: true; value: EmailTemplateJson } | { ok: false; error: EmailTemplateJsonError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: { code: 'invalid_json' } };
  }
  if (!isRecord(raw)) return { ok: false, error: { code: 'not_object' } };
  if (isEmailDocument(raw)) return { ok: true, value: { document: raw } };
  if (!isEmailDocument(raw.document)) {
    return { ok: false, error: { code: 'invalid_field', field: 'document' } };
  }
  for (const field of ['subject', 'preheader'] as const) {
    if (raw[field] !== undefined && typeof raw[field] !== 'string') {
      return { ok: false, error: { code: 'invalid_field', field } };
    }
  }
  const value: EmailTemplateJson = { document: raw.document };
  if (typeof raw.subject === 'string') value.subject = raw.subject;
  if (typeof raw.preheader === 'string') value.preheader = raw.preheader;
  return { ok: true, value };
}
