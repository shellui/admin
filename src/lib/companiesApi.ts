import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

export type CompanyDto = {
  id: number;
  name: string;
  slug: string;
  owners: number[];
};

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

async function companiesAuthFetch(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = getAuthBackendBaseUrl();
  const companyId = getCompanyIdFromJwt(accessToken);
  if (!companyId) {
    throw new Error('Missing company_id in access token.');
  }
  const url = new URL(`${base}${path}`);
  if (!url.searchParams.get('company_id')) {
    url.searchParams.set('company_id', String(companyId));
  }
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url.toString(), { ...init, headers });
}

export async function fetchMemberCompanies(accessToken: string): Promise<CompanyDto[]> {
  const res = await companiesAuthFetch('/api/companies/', accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) ?? `HTTP ${res.status}`);
  }
  if (!Array.isArray(body)) {
    throw new Error('Unexpected companies response.');
  }
  return body as CompanyDto[];
}

export async function patchCompany(
  accessToken: string,
  slug: string,
  payload: { name: string },
): Promise<CompanyDto> {
  const res = await companiesAuthFetch(`/api/companies/${encodeURIComponent(slug)}/`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) ?? `HTTP ${res.status}`);
  }
  return body as CompanyDto;
}
