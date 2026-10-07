export class ApiUnavailableError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiUnavailableError';
    this.status = status;
  }
}

export async function serviceAuthFetch(
  baseUrl: string,
  path: string,
  accessToken: string,
  init: RequestInit = {},
  options?: { companyId?: number | null; query?: Record<string, string | number | undefined> },
): Promise<Response> {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  const url = new URL(`${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`);
  if (options?.companyId != null) {
    url.searchParams.set('company_id', String(options.companyId));
  }
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url.toString(), { ...init, headers });
}

export function parseErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === 'string') return o.detail;
  if (typeof o.error === 'string') return o.error;
  const firstKey = Object.keys(o)[0];
  const v = firstKey ? o[firstKey] : null;
  if (Array.isArray(v) && typeof v[0] === 'string') return `${firstKey}: ${v[0]}`;
  if (typeof v === 'string') return v;
  return null;
}

export async function readServiceJsonOrThrow(
  res: Response,
  unavailableMessage: string,
): Promise<unknown> {
  const body = await res.json().catch(() => null);
  if (res.status === 404) {
    throw new ApiUnavailableError(404, unavailableMessage);
  }
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body;
}
