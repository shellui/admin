import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import {
  ApiUnavailableError,
  parseErrorMessage,
  readServiceJsonOrThrow,
  serviceAuthFetch,
} from '@/lib/serviceAuthFetch';

export { ApiUnavailableError, parseErrorMessage };

export async function identityAuthFetch(
  path: string,
  accessToken: string,
  init: RequestInit = {},
  options?: { companyId?: number | null; query?: Record<string, string | number | undefined> },
): Promise<Response> {
  return serviceAuthFetch(getAuthBackendBaseUrl(), path, accessToken, init, options);
}

export async function readJsonOrThrow(res: Response, unavailableMessage: string): Promise<unknown> {
  return readServiceJsonOrThrow(res, unavailableMessage);
}
