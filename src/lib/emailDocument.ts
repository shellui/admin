export const EMAIL_BLOCK_TYPES = [
  'heading',
  'text',
  'button',
  'footer',
  'list',
  'divider',
] as const;

export type EmailBlockType = (typeof EMAIL_BLOCK_TYPES)[number];

/** Inline run of a heading, text, footer, or list item. */
export type EmailRun = {
  text: string;
  bold?: true;
  italic?: true;
  underline?: true;
  href?: string;
};

export type EmailListItem = {
  text: string;
  content?: EmailRun[];
};

/**
 * One block. `text` is always the plain text. When `content` is present the
 * service renders it instead of `text`.
 */
export type EmailBlock = {
  type: EmailBlockType;
  text?: string;
  href?: string;
  content?: EmailRun[];
  ordered?: boolean;
  items?: EmailListItem[];
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

const TEXT_BLOCKS: ReadonlySet<EmailBlockType> = new Set(['heading', 'text', 'footer']);
const RUN_MARKS = ['bold', 'italic', 'underline'] as const;

export function emptyEmailDocument(): EmailDocument {
  return { preview: '', blocks: [] };
}

export function isEmailBlockType(value: string): value is EmailBlockType {
  return (EMAIL_BLOCK_TYPES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseRun(raw: unknown): EmailRun | null {
  if (!isRecord(raw) || typeof raw.text !== 'string') return null;
  const run: EmailRun = { text: raw.text };
  for (const mark of RUN_MARKS) {
    if (raw[mark] === undefined || raw[mark] === false) continue;
    if (raw[mark] !== true) return null;
    run[mark] = true;
  }
  if (raw.href !== undefined) {
    if (typeof raw.href !== 'string') return null;
    if (raw.href.trim()) run.href = raw.href;
  }
  return run;
}

function parseRuns(raw: unknown): EmailRun[] | null | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return null;
  const runs: EmailRun[] = [];
  for (const item of raw) {
    const run = parseRun(item);
    if (!run) return null;
    runs.push(run);
  }
  return runs;
}

function parseListItem(raw: unknown): EmailListItem | null {
  if (!isRecord(raw)) return null;
  if (raw.text !== undefined && typeof raw.text !== 'string') return null;
  const content = parseRuns(raw.content);
  if (content === null) return null;
  const text = typeof raw.text === 'string' ? raw.text : content ? runsPlainText(content) : '';
  return content ? { text, content } : { text };
}

/** One block from untrusted JSON, or null when a field has the wrong shape. */
export function parseEmailBlock(raw: unknown): EmailBlock | null {
  if (!isRecord(raw) || typeof raw.type !== 'string' || !isEmailBlockType(raw.type)) return null;
  const type = raw.type;
  if (raw.text !== undefined && typeof raw.text !== 'string') return null;
  if (raw.href !== undefined && typeof raw.href !== 'string') return null;
  const text = typeof raw.text === 'string' ? raw.text : '';
  if (type === 'divider') return { type };
  if (type === 'list') {
    if (raw.ordered !== undefined && typeof raw.ordered !== 'boolean') return null;
    if (!Array.isArray(raw.items)) return null;
    const items: EmailListItem[] = [];
    for (const item of raw.items) {
      const parsed = parseListItem(item);
      if (!parsed) return null;
      items.push(parsed);
    }
    return raw.ordered ? { type, ordered: true, items } : { type, items };
  }
  if (type === 'button') {
    return typeof raw.href === 'string' ? { type, text, href: raw.href } : { type, text };
  }
  const content = parseRuns(raw.content);
  if (content === null) return null;
  if (!content) return { type, text };
  return { type, text: typeof raw.text === 'string' ? text : runsPlainText(content), content };
}

export function parseEmailDocument(value: unknown): EmailDocument {
  if (!isRecord(value)) return emptyEmailDocument();
  const preview = typeof value.preview === 'string' ? value.preview : '';
  const rawBlocks = Array.isArray(value.blocks) ? value.blocks : [];
  const blocks: EmailBlock[] = [];
  for (const item of rawBlocks) {
    const block = parseEmailBlock(item);
    if (block) blocks.push(block);
  }
  return { preview, blocks };
}

export function runsPlainText(runs: EmailRun[]): string {
  return runs.map((run) => run.text).join('');
}

/** What the service renders for a text-like block. Matches `block_runs` in email-service. */
export function blockRuns(block: { text?: string; content?: EmailRun[] }): EmailRun[] {
  if (Array.isArray(block.content)) return block.content;
  return [{ text: block.text ?? '' }];
}

/** Every inline run in the document, list items included. */
export function documentRuns(document: EmailDocument): EmailRun[] {
  const runs: EmailRun[] = [];
  for (const block of document.blocks) {
    if (TEXT_BLOCKS.has(block.type)) runs.push(...blockRuns(block));
    else if (block.type === 'list') {
      for (const item of block.items ?? []) runs.push(...blockRuns(item));
    }
  }
  return runs;
}

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:)/i;

/** A link target the service keeps. Others render as plain text. */
export function safeHref(value: string | undefined): string | null {
  const href = (value ?? '').trim();
  if (!href) return null;
  if (href.startsWith('{{') || SAFE_HREF.test(href)) return href;
  return null;
}

/** Same placeholder shape as email-service `substitution.TOKEN_RE`: group 1 is the token, group 2 the default. */
export function emailTokenPattern(): RegExp {
  return /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*(?:\|\s*default\s*:\s*"([^"]*)"\s*)?\}\}/g;
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
