import { emailTokenPattern, type EmailVariable } from '@/lib/emailDocument';

/** Values email-service fills for `system.*` tokens on a test send. */
const SYSTEM_SAMPLES: Record<string, string> = {
  'system.message_id': 'msg_test',
  'system.unsubscribe_url': 'https://example.com/unsubscribe',
  'system.preferences_url': 'https://example.com/preferences',
};

/** Same as email-service `substitution.HTML_TOKEN_RE`: rendered HTML writes default quotes as `&quot;`. */
function htmlTokenPattern(): RegExp {
  return /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*(?:\|\s*default\s*:\s*(?:"|&quot;|&#34;)((?:(?!&quot;|&#34;)[^"])*)(?:"|&quot;|&#34;)\s*)?\}\}/g;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

function unescapeHtml(value: string): string {
  return new DOMParser().parseFromString(value, 'text/html').documentElement.textContent ?? value;
}

/** Example values for the preview: catalog examples plus the `system.*` samples. */
export function sampleValues(variables: EmailVariable[]): Record<string, string> {
  const values = { ...SYSTEM_SAMPLES };
  for (const variable of variables) {
    if (variable.example) values[variable.token] = variable.example;
  }
  return values;
}

/**
 * Replaces placeholders with sample values, or their default. A placeholder with
 * neither stays as written so the preview shows what is missing.
 */
export function fillSampleData(
  source: string,
  values: Record<string, string>,
  { html }: { html: boolean },
): string {
  return source.replace(
    html ? htmlTokenPattern() : emailTokenPattern(),
    (whole, token: string, fallback: string | undefined) => {
      const value =
        values[token] ||
        (fallback === undefined ? undefined : html ? unescapeHtml(fallback) : fallback);
      if (value === undefined) return whole;
      return html ? escapeHtml(value) : value;
    },
  );
}
