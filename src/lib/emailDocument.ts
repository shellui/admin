/** One React Email editor node, as stored by email-service. */
export type EmailNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: EmailMark[];
  content?: EmailNode[];
  text?: string;
};

export type EmailMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

/** Editor JSON with a `doc` root. */
export type EmailDocument = EmailNode & { type: 'doc' };

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

/** Same token email-service writes into image sources: `{{ system.assets_url }}/…`. */
export const ASSETS_TOKEN = '{{ system.assets_url }}';

export function emptyEmailDocument(): EmailDocument {
  return { type: 'doc', content: [{ type: 'container', content: [{ type: 'paragraph' }] }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isEmailDocument(value: unknown): value is EmailDocument {
  return (
    isRecord(value) &&
    value.type === 'doc' &&
    (value.content === undefined || Array.isArray(value.content))
  );
}

export function parseEmailDocument(value: unknown): EmailDocument {
  return isEmailDocument(value) ? value : emptyEmailDocument();
}

/** Every node, depth first, the root included. */
export function* documentNodes(node: EmailNode): Generator<EmailNode> {
  yield node;
  for (const child of node.content ?? []) yield* documentNodes(child);
}

function attrString(attrs: Record<string, unknown> | undefined, name: string): string {
  const value = attrs?.[name];
  return typeof value === 'string' ? value : '';
}

/** Link marks plus button and image hrefs. Matches `document.links` in email-service. */
export function documentLinks(document: EmailDocument): string[] {
  const hrefs: string[] = [];
  for (const node of documentNodes(document)) {
    if (node.type === 'button' || node.type === 'image') {
      const href = attrString(node.attrs, 'href');
      if (href) hrefs.push(href);
    }
    for (const mark of node.marks ?? []) {
      if (mark.type === 'link') hrefs.push(attrString(mark.attrs, 'href'));
    }
  }
  return hrefs;
}

export function documentTexts(document: EmailDocument): string[] {
  const texts: string[] = [];
  for (const node of documentNodes(document)) {
    if (node.type === 'text' && typeof node.text === 'string') texts.push(node.text);
  }
  return texts;
}

/** A copy with every image source passed through `map`. */
export function mapImageSources(
  document: EmailDocument,
  map: (src: string) => string,
): EmailDocument {
  const visit = (node: EmailNode): EmailNode => {
    const next: EmailNode = { ...node };
    if (node.type === 'image' && node.attrs && typeof node.attrs.src === 'string') {
      next.attrs = { ...node.attrs, src: map(node.attrs.src) };
    }
    if (node.content) next.content = node.content.map(visit);
    return next;
  };
  return visit(document) as EmailDocument;
}

/** Shows library images while editing: the token becomes the service URL. */
export function withAssetsUrl(document: EmailDocument, assetsUrl: string): EmailDocument {
  if (!assetsUrl) return document;
  return mapImageSources(document, (src) =>
    src.startsWith(`${ASSETS_TOKEN}/`) ? `${assetsUrl}${src.slice(ASSETS_TOKEN.length)}` : src,
  );
}

/** The reverse of `withAssetsUrl`, before saving. */
export function withoutAssetsUrl(document: EmailDocument, assetsUrl: string): EmailDocument {
  if (!assetsUrl) return document;
  return mapImageSources(document, (src) =>
    src.startsWith(`${assetsUrl}/`) ? `${ASSETS_TOKEN}${src.slice(assetsUrl.length)}` : src,
  );
}

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:)/i;

/** A link target the service keeps. */
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
