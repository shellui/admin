import { identityAuthFetch, parseErrorMessage, readJsonOrThrow } from '@/lib/adminIdentityFetch';
import {
  parseScimTokenCreate,
  parseScimTokensList,
  type ScimTokenCreateResponse,
  type ScimTokenRow,
} from '@/lib/scimApiParsers';

export type { ScimTokenCreateResponse, ScimTokenRow };

export type ScimConfig = {
  base_url: string;
  enabled: boolean;
  configured: boolean;
};

const UNAVAILABLE = 'SCIM API is not available on this identity version.';

export async function fetchScimConfig(accessToken: string, companyId: number): Promise<ScimConfig> {
  const res = await identityAuthFetch('/api/v1/scim', accessToken, {}, { companyId });
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected SCIM config response.');
  }
  const o = body as Record<string, unknown>;
  return {
    base_url: typeof o.base_url === 'string' ? o.base_url : '',
    enabled: o.enabled === true,
    configured: o.configured === true,
  };
}

export async function fetchScimTokens(
  accessToken: string,
  companyId: number,
): Promise<ScimTokenRow[]> {
  const res = await identityAuthFetch('/api/v1/scim/tokens', accessToken, {}, { companyId });
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  return parseScimTokensList(body);
}

export async function createScimToken(
  accessToken: string,
  companyId: number,
  payload: { label?: string; name?: string },
): Promise<ScimTokenCreateResponse> {
  const name = (payload.name ?? payload.label ?? '').trim();
  const res = await identityAuthFetch(
    '/api/v1/scim/tokens',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(name ? { name } : {}),
    },
    { companyId },
  );
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  return parseScimTokenCreate(body);
}

export async function revokeScimToken(
  accessToken: string,
  companyId: number,
  tokenId: string,
): Promise<void> {
  const res = await identityAuthFetch(
    `/api/v1/scim/tokens/${encodeURIComponent(tokenId)}/revoke`,
    accessToken,
    { method: 'POST' },
    { companyId },
  );
  if (res.status === 404) {
    throw new Error(UNAVAILABLE);
  }
  if (res.ok) return;
  const body = await res.json().catch(() => null);
  throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
}
