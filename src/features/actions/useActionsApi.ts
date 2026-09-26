import { useMemo } from 'react';
import { createIdentityActionsApiClient } from '@/lib/actionsApi';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';
import type { ActionsApiClient } from '@/features/actions/types';

export function useActionsApi(accessToken: string | null): {
  api: ActionsApiClient | null;
  companyId: number | null;
} {
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const api = useMemo(() => {
    if (!accessToken || companyId == null) return null;
    return createIdentityActionsApiClient(accessToken, companyId);
  }, [accessToken, companyId]);
  return { api, companyId };
}
