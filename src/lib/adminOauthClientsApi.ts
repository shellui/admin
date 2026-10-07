import { identityAuthFetch, parseErrorMessage, readJsonOrThrow } from '@/lib/adminIdentityFetch';
import { readOAuthApiError } from '@/lib/oauthApiErrors';
import { parseOAuthProviderCatalog } from '@/lib/oauthProviderCatalogParsers';
import type { OAuthProviderCatalogResponse } from '@/lib/oauthProviderCatalogTypes';
import type { OAuthFieldErrors } from '@/lib/oauthApiErrors';

export type { OAuthProviderCatalogResponse };

export type OAuthClientRow = {
  id: number;
  provider: 'github' | 'google' | 'microsoft';
  label: string;
  client_id: string;
  social_app_id?: number;
  tenant: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OAuthSocialAppSettings = {
  catalog_slug?: string;
};

export type OAuthSocialAppRow = {
  id: number;
  provider: string;
  allauth_provider?: string;
  provider_id?: string;
  settings?: OAuthSocialAppSettings;
  name: string;
  client_id: string;
  tenant?: string;
  extra_settings?: Record<string, unknown>;
  is_linked: boolean;
  mapping_id: number | null;
  mapping_is_active: boolean;
};

export type OAuthSocialAppsCatalog = {
  providers: string[];
  social_apps: OAuthSocialAppRow[];
};

export class OAuthApiRequestError extends Error {
  readonly fieldErrors: OAuthFieldErrors;
  readonly httpStatus: number;
  readonly errorCode: string | null;
  readonly existingSocialAppId: number | null;
  readonly isDuplicate: boolean;

  constructor(
    message: string,
    options: {
      fieldErrors?: OAuthFieldErrors;
      httpStatus?: number;
      errorCode?: string | null;
      existingSocialAppId?: number | null;
      isDuplicate?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'OAuthApiRequestError';
    this.fieldErrors = options.fieldErrors ?? {};
    this.httpStatus = options.httpStatus ?? 0;
    this.errorCode = options.errorCode ?? null;
    this.existingSocialAppId = options.existingSocialAppId ?? null;
    this.isDuplicate = options.isDuplicate ?? false;
  }
}

async function authFetch(
  path: string,
  accessToken: string,
  init: RequestInit = {},
  companyId?: number | null,
): Promise<Response> {
  return identityAuthFetch(path, accessToken, init, { companyId });
}

export async function fetchOAuthProviderCatalog(
  accessToken: string,
  companyId: number,
  options?: { includeLegacy?: boolean },
): Promise<OAuthProviderCatalogResponse> {
  const res = await authFetchWithQuery(
    '/api/v1/oauth-provider-catalog',
    accessToken,
    {},
    companyId,
    { include_legacy: options?.includeLegacy ? 1 : 0 },
  );
  const body = await readJsonOrThrow(res, 'OAuth provider catalog is not available.');
  return parseOAuthProviderCatalog(body);
}

function authFetchWithQuery(
  path: string,
  accessToken: string,
  init: RequestInit,
  companyId: number | null | undefined,
  query?: Record<string, string | number | undefined>,
): Promise<Response> {
  return identityAuthFetch(path, accessToken, init, { companyId, query });
}

export async function fetchOAuthClients(accessToken: string): Promise<OAuthClientRow[]> {
  const res = await authFetch('/api/v1/oauth-clients', accessToken);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  if (!Array.isArray(body)) {
    throw new Error('Unexpected oauth-clients response.');
  }
  return body as OAuthClientRow[];
}

export async function createOAuthClient(
  accessToken: string,
  payload: {
    social_app_id: number;
    is_active?: boolean;
  },
): Promise<OAuthClientRow> {
  const res = await authFetch('/api/v1/oauth-clients', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as OAuthClientRow;
}

export async function updateOAuthClient(
  accessToken: string,
  id: number,
  payload: {
    social_app_id?: number;
    is_active?: boolean;
  },
): Promise<OAuthClientRow> {
  const res = await authFetch(`/api/v1/oauth-clients/${id}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return body as OAuthClientRow;
}

export async function deleteOAuthClient(accessToken: string, id: number): Promise<void> {
  const res = await authFetch(`/api/v1/oauth-clients/${id}`, accessToken, {
    method: 'DELETE',
  });
  if (res.status === 204) return;
  const body = await res.json().catch(() => null);
  throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
}

function parseSocialAppRow(raw: unknown): OAuthSocialAppRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'number' ? o.id : null;
  const provider = typeof o.provider === 'string' ? o.provider : '';
  if (id == null || !provider) return null;
  const extra =
    o.extra_settings && typeof o.extra_settings === 'object'
      ? (o.extra_settings as Record<string, unknown>)
      : undefined;
  let settings: OAuthSocialAppSettings | undefined;
  if (o.settings && typeof o.settings === 'object') {
    const s = o.settings as Record<string, unknown>;
    const catalogSlug =
      typeof s.catalog_slug === 'string' && s.catalog_slug.trim()
        ? s.catalog_slug.trim()
        : undefined;
    if (catalogSlug) settings = { catalog_slug: catalogSlug };
  }
  return {
    id,
    provider,
    allauth_provider: typeof o.allauth_provider === 'string' ? o.allauth_provider : undefined,
    provider_id: typeof o.provider_id === 'string' ? o.provider_id : undefined,
    settings,
    name: typeof o.name === 'string' ? o.name : provider,
    client_id: typeof o.client_id === 'string' ? o.client_id : '',
    tenant: typeof o.tenant === 'string' ? o.tenant : undefined,
    extra_settings: extra,
    is_linked: o.is_linked !== false,
    mapping_id: typeof o.mapping_id === 'number' ? o.mapping_id : null,
    mapping_is_active: o.mapping_is_active === true,
  };
}

export async function fetchOAuthSocialApps(
  accessToken: string,
  companyId: number,
): Promise<OAuthSocialAppsCatalog> {
  const res = await authFetchWithQuery('/api/v1/oauth-social-apps', accessToken, {}, companyId);
  const body = await readJsonOrThrow(res, 'OAuth social apps API is not available.');
  if (Array.isArray(body)) {
    const social_apps = body
      .map(parseSocialAppRow)
      .filter((row): row is OAuthSocialAppRow => row != null);
    return { providers: [], social_apps };
  }
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected oauth-social-apps response.');
  }
  const obj = body as Record<string, unknown>;
  const social_apps = Array.isArray(obj.social_apps)
    ? obj.social_apps.map(parseSocialAppRow).filter((row): row is OAuthSocialAppRow => row != null)
    : [];
  return {
    providers: Array.isArray(obj.providers)
      ? obj.providers.filter((v): v is string => typeof v === 'string')
      : [],
    social_apps,
  };
}

export async function createOAuthSocialApp(
  accessToken: string,
  companyId: number,
  payload: {
    docs_slug: string;
    client_id: string;
    client_secret: string;
    tenant?: string;
    extra_settings?: Record<string, unknown>;
  },
): Promise<OAuthSocialAppRow> {
  const res = await authFetchWithQuery(
    '/api/v1/oauth-social-apps',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    companyId,
  );
  if (!res.ok) {
    const err = await readOAuthApiError(res);
    throw new OAuthApiRequestError(err.message, {
      fieldErrors: err.fieldErrors,
      httpStatus: err.httpStatus,
      errorCode: err.errorCode,
      existingSocialAppId: err.existingSocialAppId,
      isDuplicate: err.isDuplicate,
    });
  }
  const body = await res.json().catch(() => null);
  if (body && typeof body === 'object' && 'social_app' in body) {
    const row = parseSocialAppRow((body as Record<string, unknown>).social_app);
    if (row) return row;
  }
  const direct = parseSocialAppRow(body);
  if (direct) return direct;
  throw new Error('Unexpected oauth-social-apps create response.');
}

export async function deleteOAuthSocialApp(
  accessToken: string,
  companyId: number,
  id: number,
): Promise<void> {
  const res = await authFetchWithQuery(
    `/api/v1/oauth-social-apps/${id}`,
    accessToken,
    { method: 'DELETE' },
    companyId,
  );
  if (res.status === 204) return;
  const err = await readOAuthApiError(res);
  throw new OAuthApiRequestError(err.message, {
    fieldErrors: err.fieldErrors,
    httpStatus: err.httpStatus,
    errorCode: err.errorCode,
    existingSocialAppId: err.existingSocialAppId,
    isDuplicate: err.isDuplicate,
  });
}

export async function updateOAuthSocialApp(
  accessToken: string,
  companyId: number,
  id: number,
  payload: {
    client_id?: string;
    client_secret?: string;
    tenant?: string;
    extra_settings?: Record<string, unknown>;
  },
): Promise<OAuthSocialAppRow> {
  const res = await authFetchWithQuery(
    `/api/v1/oauth-social-apps/${id}`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    companyId,
  );
  if (!res.ok) {
    const err = await readOAuthApiError(res);
    throw new OAuthApiRequestError(err.message, {
      fieldErrors: err.fieldErrors,
      httpStatus: err.httpStatus,
      errorCode: err.errorCode,
      existingSocialAppId: err.existingSocialAppId,
      isDuplicate: err.isDuplicate,
    });
  }
  const body = await res.json().catch(() => null);
  const row = parseSocialAppRow(body);
  if (!row) throw new Error('Unexpected oauth-social-apps update response.');
  return row;
}
