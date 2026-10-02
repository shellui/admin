export class EmailApiError extends Error {
  readonly errorCode: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly status: number;

  constructor(errorCode: string, status: number, fieldErrors: Record<string, string[]> = {}) {
    super(errorCode);
    this.name = 'EmailApiError';
    this.errorCode = errorCode;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function statusFallbackCode(status: number): string {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 405) return 'method_not_allowed';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  if (status === 400) return 'validation_failed';
  return 'request_failed';
}

/**
 * Read `error_code` and `field_errors` only.
 * Sentence fields such as `detail` are ignored so the UI never shows API prose.
 */
export function parseEmailApiError(body: unknown, status: number): EmailApiError {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const rawCode = record.error_code;
  const errorCode =
    typeof rawCode === 'string' && rawCode.trim() ? rawCode.trim() : statusFallbackCode(status);
  const fieldErrors: Record<string, string[]> = {};
  const rawFields = record.field_errors;
  if (rawFields && typeof rawFields === 'object') {
    for (const [key, value] of Object.entries(rawFields as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      const codes = value.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
      if (codes.length) fieldErrors[key] = codes;
    }
  }
  return new EmailApiError(errorCode, status, fieldErrors);
}

type Translate = (key: string) => string;

export function emailErrorText(t: Translate, error: unknown): string {
  if (!(error instanceof EmailApiError)) return t('emailError_request_failed');
  const codeKey = `emailError_${error.errorCode}`;
  const translated = t(codeKey);
  if (error.fieldErrors.version?.includes('draft_required')) return t('emailError_draft_required');
  const base = translated === codeKey ? t('emailError_request_failed') : translated;
  const fields = Object.entries(error.fieldErrors)
    .map(([field, codes]) => {
      const rendered = codes
        .map((code) => {
          const fieldKey = `emailFieldError_${code}`;
          const label = t(fieldKey);
          return label === fieldKey ? code : label;
        })
        .join(', ');
      return `${field}: ${rendered}`;
    })
    .join('; ');
  return fields ? `${base} (${fields})` : base;
}
