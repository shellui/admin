import { parseEmailBlock, type EmailBlock, type EmailDocument } from '@/lib/emailDocument';
import { completeThemePalette, isEmailThemeKey } from '@/lib/emailTheme';

/**
 * Copy and paste format for one language. Same shape as the email-service
 * `defaults/<service>/<event>/<lang>.json` files, plus the look of the email.
 */
export type EmailTemplateJson = {
  /** Omitted keeps the current subject. */
  subject?: string;
  /** Omitted keeps the current preheader. */
  preheader?: string;
  document: EmailDocument;
  /** Template key. Omitted keeps the current template. */
  theme_name?: string;
  /** `{}` keeps the template colors. Omitted keeps the current colors. */
  theme_palette?: Record<string, string>;
};

export type EmailTemplateJsonError =
  | { code: 'invalid_json' }
  | { code: 'not_object' }
  | { code: 'invalid_field'; field: string }
  | { code: 'invalid_block'; index: number }
  | { code: 'unknown_template'; value: string }
  | { code: 'invalid_palette' };

export function templateJsonText(value: EmailTemplateJson): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseBlocks(raw: unknown): EmailBlock[] | EmailTemplateJsonError {
  if (!Array.isArray(raw)) return { code: 'invalid_field', field: 'document.blocks' };
  const blocks: EmailBlock[] = [];
  for (const [index, item] of raw.entries()) {
    const block = parseEmailBlock(item);
    if (!block) return { code: 'invalid_block', index };
    blocks.push(block);
  }
  return blocks;
}

/** Accepts the full object or a bare `{ preview, blocks }` document. */
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
  const bare = !('document' in raw) && 'blocks' in raw;
  const documentRaw = bare ? raw : raw.document;
  if (!isRecord(documentRaw)) {
    return { ok: false, error: { code: 'invalid_field', field: 'document' } };
  }
  for (const field of bare ? [] : (['subject', 'preheader'] as const)) {
    if (raw[field] !== undefined && typeof raw[field] !== 'string') {
      return { ok: false, error: { code: 'invalid_field', field } };
    }
  }
  if (documentRaw.preview !== undefined && typeof documentRaw.preview !== 'string') {
    return { ok: false, error: { code: 'invalid_field', field: 'document.preview' } };
  }
  const blocks = parseBlocks(documentRaw.blocks);
  if (!Array.isArray(blocks)) return { ok: false, error: blocks };

  const value: EmailTemplateJson = {
    document: {
      preview: typeof documentRaw.preview === 'string' ? documentRaw.preview : '',
      blocks,
    },
  };
  if (bare) return { ok: true, value };
  if (typeof raw.subject === 'string') value.subject = raw.subject;
  if (typeof raw.preheader === 'string') value.preheader = raw.preheader;

  if (raw.theme_name !== undefined) {
    if (typeof raw.theme_name !== 'string' || !isEmailThemeKey(raw.theme_name)) {
      return { ok: false, error: { code: 'unknown_template', value: String(raw.theme_name) } };
    }
    value.theme_name = raw.theme_name;
  }
  if (raw.theme_palette !== undefined) {
    if (!isRecord(raw.theme_palette)) return { ok: false, error: { code: 'invalid_palette' } };
    const palette = raw.theme_palette as Record<string, string>;
    if (Object.keys(palette).length === 0) {
      value.theme_palette = {};
    } else {
      const complete = completeThemePalette(palette);
      if (!complete) return { ok: false, error: { code: 'invalid_palette' } };
      value.theme_palette = complete;
    }
  }
  return { ok: true, value };
}
