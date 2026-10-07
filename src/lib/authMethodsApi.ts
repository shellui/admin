import { identityAuthFetch, readJsonOrThrow } from '@/lib/adminIdentityFetch';

export type AuthMethodsDto = {
  enable_magic_link: boolean;
  magic_link_effective: boolean;
  magic_link_globally_enabled: boolean;
};

const UNAVAILABLE = 'Auth methods API is not available on this identity version.';

function parseAuthMethods(body: unknown): AuthMethodsDto {
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected auth-methods response.');
  }
  const o = body as Record<string, unknown>;
  return {
    enable_magic_link: o.enable_magic_link === true,
    magic_link_effective: o.magic_link_effective === true,
    magic_link_globally_enabled: o.magic_link_globally_enabled === true,
  };
}

export async function fetchAuthMethods(
  accessToken: string,
  companyId: number,
): Promise<AuthMethodsDto> {
  const res = await identityAuthFetch('/api/v1/auth-methods', accessToken, {}, { companyId });
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  return parseAuthMethods(body);
}

export async function patchAuthMethods(
  accessToken: string,
  companyId: number,
  payload: { enable_magic_link?: boolean },
): Promise<AuthMethodsDto> {
  const res = await identityAuthFetch(
    '/api/v1/auth-methods',
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    { companyId },
  );
  const body = await readJsonOrThrow(res, UNAVAILABLE);
  return parseAuthMethods(body);
}
