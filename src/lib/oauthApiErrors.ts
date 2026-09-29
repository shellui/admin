export type OAuthFieldErrors = Record<string, string>;

const DUPLICATE_ERROR_CODES = new Set([
  'duplicate',
  'duplicate_provider',
  'provider_already_configured',
  'social_app_duplicate',
  'already_configured',
]);

export type OAuthApiErrorPayload = {
  message: string | null;
  fieldErrors: OAuthFieldErrors;
  httpStatus: number;
  errorCode: string | null;
  existingSocialAppId: number | null;
  isDuplicate: boolean;
};

function readErrorCode(o: Record<string, unknown>): string | null {
  for (const key of ['code', 'error_code', 'errorCode'] as const) {
    const value = o[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function readExistingSocialAppId(o: Record<string, unknown>): number | null {
  for (const key of [
    'existing_social_app_id',
    'social_app_id',
    'existing_app_id',
    'app_id',
  ] as const) {
    const value = o[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  if (o.existing_social_app && typeof o.existing_social_app === 'object') {
    const nested = o.existing_social_app as Record<string, unknown>;
    if (typeof nested.id === 'number') return nested.id;
  }
  return null;
}

function isDuplicateError(code: string | null, httpStatus: number): boolean {
  if (httpStatus === 409) return true;
  if (!code) return false;
  const normalized = code.toLowerCase();
  if (DUPLICATE_ERROR_CODES.has(normalized)) return true;
  return normalized.includes('duplicate');
}

export function parseOAuthApiErrorPayload(body: unknown, httpStatus: number): OAuthApiErrorPayload {
  const { message, fieldErrors } = parseOAuthApiFieldErrors(body);
  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const errorCode = readErrorCode(o);
  const existingSocialAppId = readExistingSocialAppId(o);
  const isDuplicate =
    isDuplicateError(errorCode, httpStatus) ||
    (httpStatus === 400 && isDuplicateError(errorCode, 409));
  return {
    message,
    fieldErrors,
    httpStatus,
    errorCode,
    existingSocialAppId,
    isDuplicate,
  };
}

export function parseOAuthApiFieldErrors(body: unknown): {
  message: string | null;
  fieldErrors: OAuthFieldErrors;
} {
  const fieldErrors: OAuthFieldErrors = {};
  if (!body || typeof body !== 'object') {
    return { message: null, fieldErrors };
  }
  const o = body as Record<string, unknown>;
  let message: string | null = null;
  if (typeof o.detail === 'string' && o.detail.trim()) {
    message = o.detail.trim();
  } else if (typeof o.error === 'string' && o.error.trim()) {
    message = o.error.trim();
  }

  for (const [key, value] of Object.entries(o)) {
    if (key === 'detail' || key === 'error') continue;
    if (Array.isArray(value) && typeof value[0] === 'string') {
      fieldErrors[key] = value[0];
      if (!message) message = `${key}: ${value[0]}`;
    } else if (typeof value === 'string' && value.trim()) {
      fieldErrors[key] = value.trim();
      if (!message) message = `${key}: ${value.trim()}`;
    }
  }
  return { message, fieldErrors };
}

export async function readOAuthApiError(res: Response): Promise<{
  message: string;
  fieldErrors: OAuthFieldErrors;
  httpStatus: number;
  errorCode: string | null;
  existingSocialAppId: number | null;
  isDuplicate: boolean;
}> {
  const body = await res.json().catch(() => null);
  const parsed = parseOAuthApiErrorPayload(body, res.status);
  return {
    message: parsed.message || `Request failed (${res.status})`,
    fieldErrors: parsed.fieldErrors,
    httpStatus: parsed.httpStatus,
    errorCode: parsed.errorCode,
    existingSocialAppId: parsed.existingSocialAppId,
    isDuplicate: parsed.isDuplicate,
  };
}
