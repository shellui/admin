import { useMemo } from 'react';
import { createActionsApiClient } from '@/lib/actionsApi';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';
import type { ActionsApiClient } from '@/features/actions/types';
import { useWebhookServices } from '@/features/actions/useWebhookServices';
import type { WebhookServiceKey } from '@/lib/webhookServices';

export function useActionsApi(
  accessToken: string | null,
  serviceKey: WebhookServiceKey,
): {
  api: ActionsApiClient | null;
  companyId: number | null;
  serviceConfigured: boolean;
} {
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const { getBaseUrl } = useWebhookServices();
  const baseUrl = getBaseUrl(serviceKey);

  const api = useMemo(() => {
    if (!accessToken || companyId == null || !baseUrl) return null;
    return createActionsApiClient(baseUrl, accessToken, companyId, serviceKey);
  }, [accessToken, baseUrl, companyId, serviceKey]);

  return { api, companyId, serviceConfigured: Boolean(baseUrl) };
}
