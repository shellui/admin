import type { EmailDocument, EmailLang, EmailNode } from '@/lib/emailDocument';

/**
 * One layout, text per language. The template's document is the layout in its
 * main language; every other language keeps its subject, preheader, and the
 * content of text blocks matched by `attrs.textId`. Matches
 * `apps/email/translations.py` in email-service.
 */

export const EMAIL_LANGS: EmailLang[] = ['en', 'fr'];

/** Blocks whose text is translated. Mirrored in email-service `renderer/editor.mjs`. */
export const TEXT_BLOCK_TYPES = ['paragraph', 'heading', 'button', 'codeBlock'] as const;

const TEXT_BLOCKS = new Set<string>(TEXT_BLOCK_TYPES);

export type EmailTranslatedBlock = {
  content: EmailNode[];
  /** Fingerprint of the main text it was translated from. */
  source: string;
};

export type EmailTranslation = {
  subject: string;
  preheader: string;
  blocks: Record<string, EmailTranslatedBlock>;
};

export type EmailTranslations = Partial<Record<EmailLang, EmailTranslation>>;

export type EmailInbox = { subject: string; preheader: string };

export type EmailTranslationStatus = {
  /** Blocks still showing the main text. */
  missing: string[];
  /** Blocks whose main text changed since they were translated. */
  outdated: string[];
  subjectMissing: boolean;
  preheaderMissing: boolean;
  /** Everything left to do. */
  todo: number;
};

export function isEmailLang(value: unknown): value is EmailLang {
  return EMAIL_LANGS.includes(value as EmailLang);
}

export function newTextId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, '0');
}

function textId(node: EmailNode): string | null {
  const id = node.attrs?.textId;
  return typeof id === 'string' && id ? id : null;
}

function isTextBlock(node: EmailNode): boolean {
  return TEXT_BLOCKS.has(node.type);
}

function plainText(content: EmailNode[] | undefined): string {
  return (content ?? []).map((node) => node.text ?? '').join('');
}

/** Sorted keys, without empty attributes, so equal content compares equal. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const item = (value as Record<string, unknown>)[key];
    if (item === null || item === undefined || item === '') continue;
    const next = canonical(item);
    if (key === 'attrs' && next && typeof next === 'object' && !Object.keys(next).length) continue;
    out[key] = next;
  }
  return out;
}

function sameContent(a: EmailNode[] | undefined, b: EmailNode[] | undefined): boolean {
  return JSON.stringify(canonical(a ?? [])) === JSON.stringify(canonical(b ?? []));
}

export function blockFingerprint(content: EmailNode[] | undefined): string {
  const text = JSON.stringify(canonical(content ?? []));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Words to translate: anything left once `{{ placeholders }}` are removed. */
export function hasWords(text: string): boolean {
  return /\p{L}/u.test(text.replace(/\{\{[^}]*\}\}/g, ''));
}

function mapTextBlocks(
  node: EmailNode,
  visit: (block: EmailNode, id: string | null) => EmailNode,
): EmailNode {
  if (isTextBlock(node)) return visit(node, textId(node));
  if (!node.content) return node;
  return { ...node, content: node.content.map((child) => mapTextBlocks(child, visit)) };
}

function withContent(node: EmailNode, content: EmailNode[] | undefined): EmailNode {
  const next = { ...node };
  if (content?.length) next.content = content;
  else delete next.content;
  return next;
}

/** Text blocks by id, in document order. */
export function textBlocks(document: EmailDocument): Map<string, EmailNode> {
  const blocks = new Map<string, EmailNode>();
  mapTextBlocks(document, (block, id) => {
    if (id && !blocks.has(id)) blocks.set(id, block);
    return block;
  });
  return blocks;
}

/** Ids for blocks that have none, and for copies. The copy with the most text keeps an id. */
export function withTextIds(document: EmailDocument): EmailDocument {
  const longest = new Map<string, number>();
  mapTextBlocks(document, (block, id) => {
    if (id) longest.set(id, Math.max(longest.get(id) ?? -1, plainText(block.content).length));
    return block;
  });
  const kept = new Set<string>();
  return mapTextBlocks(document, (block, id) => {
    if (id && !kept.has(id) && plainText(block.content).length === longest.get(id)) {
      kept.add(id);
      return block;
    }
    return { ...block, attrs: { ...block.attrs, textId: newTextId() } };
  }) as EmailDocument;
}

/** The document as `translation` reads it. Untranslated blocks keep the main text. */
export function localizeDocument(
  document: EmailDocument,
  translation: EmailTranslation | undefined,
): EmailDocument {
  if (!translation) return document;
  return mapTextBlocks(document, (block, id) => {
    const entry = id ? translation.blocks[id] : undefined;
    return entry ? withContent(block, entry.content) : block;
  }) as EmailDocument;
}

/**
 * Splits an edit made while reading `translation`: layout and attributes go
 * to the shared document, text to the translation. A block added in this
 * language becomes main text too, until the main language rewrites it.
 */
export function applyTranslatedEdit(
  base: EmailDocument,
  translation: EmailTranslation,
  edited: EmailDocument,
): { base: EmailDocument; translation: EmailTranslation } {
  const original = textBlocks(base);
  const blocks: Record<string, EmailTranslatedBlock> = {};
  const nextBase = mapTextBlocks(edited, (block, id) => {
    if (!id) return block;
    const content = block.content ?? [];
    const main = original.get(id);
    if (!main) {
      if (content.length) blocks[id] = { content, source: blockFingerprint(content) };
      return block;
    }
    const previous = translation.blocks[id];
    if (previous && sameContent(previous.content, content)) blocks[id] = previous;
    else if (previous || !sameContent(main.content, content)) {
      blocks[id] = { content, source: blockFingerprint(main.content) };
    }
    return withContent(block, main.content);
  }) as EmailDocument;
  return { base: nextBase, translation: { ...translation, blocks } };
}

/** Drops translated blocks the layout no longer has. */
export function pruneTranslations(
  base: EmailDocument,
  translations: EmailTranslations,
): EmailTranslations {
  const ids = textBlocks(base);
  const next: EmailTranslations = {};
  for (const [lang, translation] of Object.entries(translations) as Array<
    [EmailLang, EmailTranslation]
  >) {
    const blocks = Object.fromEntries(
      Object.entries(translation.blocks).filter(([id]) => ids.has(id)),
    );
    next[lang] =
      Object.keys(blocks).length === Object.keys(translation.blocks).length
        ? translation
        : { ...translation, blocks };
  }
  return next;
}

export function translationStatus(
  base: EmailDocument,
  translation: EmailTranslation | undefined,
  main: EmailInbox,
): EmailTranslationStatus {
  const missing: string[] = [];
  const outdated: string[] = [];
  for (const [id, block] of textBlocks(base)) {
    const entry = translation?.blocks[id];
    if (!entry) {
      if (hasWords(plainText(block.content))) missing.push(id);
    } else if (entry.source !== blockFingerprint(block.content)) {
      outdated.push(id);
    }
  }
  const subjectMissing = !translation?.subject && hasWords(main.subject);
  const preheaderMissing = !translation?.preheader && hasWords(main.preheader);
  return {
    missing,
    outdated,
    subjectMissing,
    preheaderMissing,
    todo: missing.length + outdated.length + Number(subjectMissing) + Number(preheaderMissing),
  };
}

/** Confirms every translated block against the current main text. */
export function markTranslationCurrent(
  base: EmailDocument,
  translation: EmailTranslation,
): EmailTranslation {
  const main = textBlocks(base);
  const blocks = Object.fromEntries(
    Object.entries(translation.blocks).map(([id, entry]) => [
      id,
      { ...entry, source: blockFingerprint(main.get(id)?.content) },
    ]),
  );
  return { ...translation, blocks };
}

/**
 * A translation for every other language. An untouched suggested subject
 * starts in that language's suggestion.
 */
export function withAllLanguages(
  translations: EmailTranslations,
  mainLang: EmailLang,
  main: EmailInbox,
  suggested: Partial<Record<EmailLang, EmailInbox>>,
): EmailTranslations {
  const next: EmailTranslations = { ...translations };
  const fromSuggestion =
    suggested[mainLang]?.subject === main.subject &&
    (suggested[mainLang]?.preheader ?? '') === main.preheader;
  for (const lang of EMAIL_LANGS) {
    if (lang === mainLang || next[lang]) continue;
    const pack = fromSuggestion ? suggested[lang] : undefined;
    next[lang] = { subject: pack?.subject ?? '', preheader: pack?.preheader ?? '', blocks: {} };
  }
  return next;
}

function parseBlock(value: unknown): EmailTranslatedBlock | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.content)) return null;
  return {
    content: row.content as EmailNode[],
    source: typeof row.source === 'string' ? row.source : '',
  };
}

export function parseTranslations(value: unknown): EmailTranslations {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: EmailTranslations = {};
  for (const [lang, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isEmailLang(lang) || !raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const blocks: Record<string, EmailTranslatedBlock> = {};
    if (row.blocks && typeof row.blocks === 'object') {
      for (const [id, block] of Object.entries(row.blocks as Record<string, unknown>)) {
        const parsed = parseBlock(block);
        if (parsed) blocks[id] = parsed;
      }
    }
    out[lang] = {
      subject: typeof row.subject === 'string' ? row.subject : '',
      preheader: typeof row.preheader === 'string' ? row.preheader : '',
      blocks,
    };
  }
  return out;
}
