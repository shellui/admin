import { requireAuthBackendBaseUrl } from '@/lib/backendUrl';

export type CompanyAccessMode = 'public' | 'domain' | 'invite';

export type CompanyDto = {
  id: number;
  name: string;
  slug: string;
  owners: number[];
  access_mode: CompanyAccessMode;
  allowed_email_domains: string[];
  /** Empty list means desktop sign-in is off for every method. */
  desktop_redirect_schemes: string[];
  /** When true, each listed scheme also accepts its `-dev` variant. */
  allow_desktop_dev_scheme: boolean;
};

export class CompanyFieldError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string>) {
    super(message);
    this.name = 'CompanyFieldError';
    this.fieldErrors = fieldErrors;
  }
}

function parseErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.error === 'string') return o.error;
  if (typeof o.detail === 'string') return o.detail;
  const firstKey = Object.keys(o)[0];
  const v = firstKey ? o[firstKey] : null;
  if (Array.isArray(v) && typeof v[0] === 'string') return `${firstKey}: ${v[0]}`;
  if (typeof v === 'string') return v;
  return null;
}

function firstFieldMessage(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = firstFieldMessage(item);
      if (nested) return nested;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const nested = firstFieldMessage(item);
      if (nested) return nested;
    }
  }
  return null;
}

function readFieldErrors(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (key === 'error' || key === 'detail' || key === 'error_code') continue;
    const message = firstFieldMessage(value);
    if (message) out[key] = message;
  }
  return out;
}

function readSchemes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === 'string');
}

function readBool(raw: unknown): boolean {
  return raw === true;
}

function parseCompany(raw: unknown): CompanyDto {
  const row = (raw && typeof raw === 'object' ? raw : {}) as CompanyDto;
  const source = raw as {
    desktop_redirect_schemes?: unknown;
    allow_desktop_dev_scheme?: unknown;
  } | null;
  return {
    ...row,
    desktop_redirect_schemes: readSchemes(source?.desktop_redirect_schemes),
    allow_desktop_dev_scheme: readBool(source?.allow_desktop_dev_scheme),
  };
}

async function companiesAuthFetch(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = requireAuthBackendBaseUrl();
  const url = new URL(`${base}${path}`);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url.toString(), { ...init, headers });
}

export async function fetchMemberCompanies(accessToken: string): Promise<CompanyDto[]> {
  const res = await companiesAuthFetch('/api/v1/companies/', accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) ?? `HTTP ${res.status}`);
  }
  if (!Array.isArray(body)) {
    throw new Error('Unexpected companies response.');
  }
  return body.map(parseCompany);
}

export async function patchCompany(
  accessToken: string,
  companyId: number,
  payload: {
    name?: string;
    access_mode?: CompanyAccessMode;
    allowed_email_domains?: string[];
    desktop_redirect_schemes?: string[];
    allow_desktop_dev_scheme?: boolean;
  },
): Promise<CompanyDto> {
  const res = await companiesAuthFetch(`/api/v1/companies/${companyId}/`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = parseErrorMessage(body) ?? `HTTP ${res.status}`;
    const fieldErrors = readFieldErrors(body);
    if (Object.keys(fieldErrors).length > 0) {
      throw new CompanyFieldError(message, fieldErrors);
    }
    throw new Error(message);
  }
  return parseCompany(body);
}
