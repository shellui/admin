export type OAuthFieldErrors = Record<string, string>;

export function parseOAuthApiFieldErrors(body: unknown): {
  message: string | null;
  fieldErrors: OAuthFieldErrors;
} {
  const fieldErrors: OAuthFieldErrors = {};
  if (!body || typeof body !== 'object') {
    return { message: null, fieldErrors };
  }
  const o = body as Record<string, unknown>;
  if (typeof o.detail === 'string' && o.detail.trim()) {
    return { message: o.detail.trim(), fieldErrors };
  }
  if (typeof o.error === 'string' && o.error.trim()) {
    return { message: o.error.trim(), fieldErrors };
  }

  let message: string | null = null;
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
}> {
  const body = await res.json().catch(() => null);
  const parsed = parseOAuthApiFieldErrors(body);
  return {
    message: parsed.message || `Request failed (${res.status})`,
    fieldErrors: parsed.fieldErrors,
  };
}
