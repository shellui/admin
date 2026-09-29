/**
 * Port of identity-service `substitute_action_email_template` for admin preview.
 * Replaces `{{ dotted.path }}` / `{{ path|default:"x" }}` / `|title` from a context
 * shaped like send-time: `{ envelope, data }`.
 *
 * HTML mode escapes values and scheme-checks URL attributes (href/src/…).
 * Plain mode (subjects) strips CR/LF only.
 */

export type EmailPreviewContext = {
  envelope?: Record<string, unknown>;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export type SubstituteMode = 'html' | 'plain';

const PLACEHOLDER_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

const URL_ATTR_BEFORE_RE =
  /(?:href|src|xlink:href|poster|action|formaction|cite)\s*=\s*(["'])(?:(?!\1)[\s\S])*$/i;

const SAFE_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function lookupPath(context: EmailPreviewContext, path: string): unknown {
  let current: unknown = context;
  for (const part of path.split('.')) {
    if (current == null || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function resolveExpr(expr: string, context: EmailPreviewContext): string {
  const trimmed = expr.trim();
  const pipe = trimmed.indexOf('|');
  const pathPart = (pipe === -1 ? trimmed : trimmed.slice(0, pipe)).trim();
  let value: unknown = lookupPath(context, pathPart);

  if (pipe !== -1) {
    const filterChain = trimmed.slice(pipe + 1);
    for (const rawSegment of filterChain.split('|')) {
      const segment = rawSegment.trim();
      if (!segment) continue;
      if (segment.startsWith('default:')) {
        const defaultRaw = segment.slice('default:'.length).trim();
        let defaultVal: unknown;
        if (
          (defaultRaw.startsWith('"') && defaultRaw.endsWith('"')) ||
          (defaultRaw.startsWith("'") && defaultRaw.endsWith("'"))
        ) {
          defaultVal = defaultRaw.slice(1, -1);
        } else {
          const looked = lookupPath(context, defaultRaw);
          defaultVal = looked !== undefined && looked !== null ? looked : defaultRaw;
        }
        if (value === undefined || value === null || value === '') {
          value = defaultVal;
        }
      } else if (segment === 'title') {
        value =
          value == null
            ? ''
            : String(value).replace(/\w\S*/g, (w) => {
                return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
              });
      }
    }
  }

  if (value === undefined || value === null) return '';
  return String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function sanitizeActionEmailUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed === '#') return '#';
  try {
    const url = new URL(trimmed);
    if (!SAFE_URL_SCHEMES.has(url.protocol)) return '';
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.host) return '';
    if (url.protocol === 'mailto:' || url.protocol === 'tel:') {
      const rest = trimmed.slice(url.protocol.length).trim();
      if (!rest) return '';
    }
    return trimmed;
  } catch {
    return '';
  }
}

function inUrlAttribute(text: string, pos: number): boolean {
  const window = text.slice(Math.max(0, pos - 512), pos);
  return URL_ATTR_BEFORE_RE.test(window);
}

function encodeHtmlValue(raw: string, inUrlAttr: boolean): string {
  if (inUrlAttr) {
    return escapeHtml(sanitizeActionEmailUrl(raw));
  }
  return escapeHtml(raw);
}

function encodePlainValue(raw: string): string {
  return raw.replace(/\r/g, ' ').replace(/\n/g, ' ');
}

/** Replace ``{{ envelope.company.name }}``-style placeholders from *context*. */
export function substituteActionEmailTemplate(
  text: string,
  context: EmailPreviewContext,
  mode: SubstituteMode = 'html',
): string {
  return text.replace(PLACEHOLDER_RE, (_match, expr: string, offset: number) => {
    const raw = resolveExpr(expr, context);
    if (mode === 'plain') return encodePlainValue(raw);
    return encodeHtmlValue(raw, inUrlAttribute(text, offset));
  });
}

function setPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.').filter(Boolean);
  if (!parts.length) return;
  let cursor: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = cursor[key];
    if (next == null || typeof next !== 'object' || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

export type TemplateVariableExample = {
  token: string;
  example?: unknown;
};

/**
 * Build a send-shaped preview context from catalog variable examples.
 * Prefer identity `sample_context` when available; this is the fallback.
 */
export function buildEmailPreviewContextFromVariables(
  variables: TemplateVariableExample[],
  overrides?: Partial<EmailPreviewContext>,
): EmailPreviewContext {
  const envelope: Record<string, unknown> = {
    id: '00000000-0000-4000-8000-000000000001',
    type: 'identity.user.created',
    time: '2026-01-01T12:00:00+00:00',
    company: { id: 1, slug: 'acme', name: 'Acme' },
    data: {} as Record<string, unknown>,
  };
  const data: Record<string, unknown> = {};

  for (const variable of variables) {
    if (variable.example === undefined || variable.example === null) continue;
    const token = variable.token.trim();
    if (token.startsWith('envelope.')) {
      setPath(envelope, token.slice('envelope.'.length), variable.example);
    } else if (token.startsWith('data.')) {
      data[token.slice('data.'.length)] = variable.example;
    } else {
      data[token] = variable.example;
    }
  }

  (envelope as { data: Record<string, unknown> }).data = {
    ...(envelope.data as Record<string, unknown>),
    ...data,
  };

  return {
    envelope,
    data: { ...(envelope.data as Record<string, unknown>) },
    ...overrides,
  };
}

export function normalizeEmailPreviewContext(raw: unknown): EmailPreviewContext | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const envelope =
    o.envelope && typeof o.envelope === 'object' && !Array.isArray(o.envelope)
      ? (o.envelope as Record<string, unknown>)
      : undefined;
  const data =
    o.data && typeof o.data === 'object' && !Array.isArray(o.data)
      ? (o.data as Record<string, unknown>)
      : envelope &&
          envelope.data &&
          typeof envelope.data === 'object' &&
          !Array.isArray(envelope.data)
        ? (envelope.data as Record<string, unknown>)
        : undefined;
  if (!envelope && !data) return null;
  return {
    envelope: envelope ?? {},
    data: data ?? {},
  };
}
