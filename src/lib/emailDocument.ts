export const EMAIL_BLOCK_TYPES = ['heading', 'text', 'button', 'footer'] as const;

export type EmailBlockType = (typeof EMAIL_BLOCK_TYPES)[number];

export type EmailBlock = {
  type: EmailBlockType;
  text: string;
  href?: string;
};

export type EmailDocument = {
  preview: string;
  blocks: EmailBlock[];
};

export type EmailLang = 'en' | 'fr';

export type EmailVariable = {
  token: string;
  type: string;
  required: boolean;
  description: string;
  example: string;
  isUrl: boolean;
  /** Present when the catalog points button hosts at an operator allowlist. */
  allowedHostsSetting?: string;
};

export function emptyEmailDocument(): EmailDocument {
  return { preview: '', blocks: [] };
}

export function isEmailBlockType(value: string): value is EmailBlockType {
  return (EMAIL_BLOCK_TYPES as readonly string[]).includes(value);
}

export function parseEmailDocument(value: unknown): EmailDocument {
  if (!value || typeof value !== 'object') return emptyEmailDocument();
  const record = value as Record<string, unknown>;
  const preview = typeof record.preview === 'string' ? record.preview : '';
  const rawBlocks = Array.isArray(record.blocks) ? record.blocks : [];
  const blocks: EmailBlock[] = [];
  for (const item of rawBlocks) {
    if (!item || typeof item !== 'object') continue;
    const block = item as Record<string, unknown>;
    const type = typeof block.type === 'string' ? block.type : '';
    if (!isEmailBlockType(type)) continue;
    const text = typeof block.text === 'string' ? block.text : '';
    const href = typeof block.href === 'string' ? block.href : undefined;
    blocks.push(href !== undefined ? { type, text, href } : { type, text });
  }
  return { preview, blocks };
}

/** Mustache token written by the variable palette. */
export function formatEmailPlaceholder(token: string): string {
  return `{{ ${token.trim()} }}`;
}

export function insertAtSelection(
  value: string,
  start: number,
  end: number,
  insert: string,
): { value: string; caret: number } {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  const next = `${value.slice(0, safeStart)}${insert}${value.slice(safeEnd)}`;
  const caret = safeStart + insert.length;
  return { value: next, caret };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type EmailPreviewPalette = {
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  border: string;
};

export const SHELLUI_EMAIL_PALETTE: EmailPreviewPalette = {
  background: '#ffffff',
  foreground: '#1a1408',
  muted: '#f6f4ef',
  mutedForeground: '#6b645b',
  primary: '#e3a512',
  primaryForeground: '#1a1408',
  border: '#e7e0d4',
};

/** Local preview. The service applies the same palette when the version is sent. */
export function renderEmailPreviewHtml(
  document: EmailDocument,
  palette: EmailPreviewPalette = SHELLUI_EMAIL_PALETTE,
): string {
  const preview = escapeHtml(document.preview);
  const blocks = document.blocks
    .map((block) => {
      const text = escapeHtml(block.text);
      if (block.type === 'heading') {
        return `<h1 style="margin:8px 32px 12px;font-size:26px;line-height:1.3;color:${escapeHtml(palette.foreground)};">${text}</h1>`;
      }
      if (block.type === 'button') {
        const href = escapeHtml(block.href ?? '');
        return `<p style="margin:8px 32px 20px;"><a href="${href}" style="display:inline-block;background:${escapeHtml(palette.primary)};color:${escapeHtml(palette.primaryForeground)};text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;">${text}</a></p>`;
      }
      if (block.type === 'footer') {
        return `<p style="margin:8px 32px 28px;font-size:12px;line-height:1.5;color:${escapeHtml(palette.mutedForeground)};">${text}</p>`;
      }
      return `<p style="margin:0 32px 14px;font-size:16px;line-height:1.55;color:${escapeHtml(palette.foreground)};">${text}</p>`;
    })
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:${escapeHtml(palette.muted)};color:${escapeHtml(palette.foreground)};font-family:Georgia,serif;"><div style="display:none;max-height:0;overflow:hidden;">${preview}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${escapeHtml(palette.background)};border:1px solid ${escapeHtml(palette.border)};border-radius:12px;"><tr><td style="padding:28px 32px 8px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:${escapeHtml(palette.primary)};">Shellui</td></tr><tr><td>${blocks}</td></tr></table></td></tr></table></body></html>`;
}
