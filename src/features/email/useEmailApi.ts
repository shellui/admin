import { useMemo } from 'react';
import { useShelluiEmail } from '@/hooks/useShelluiEmail';
import { isEmailAdminEnabled, resolveEmailServiceUrl } from '@/lib/emailServiceUrl';
import { createEmailApiClient, type EmailApiClient } from '@/lib/emailApi';
import { getCompanyIdFromJwt, getIsCompanyOwnerFromJwt, getIsStaffFromJwt } from '@/lib/jwtCompany';

export function useEmailBaseUrl(): string {
  const email = useShelluiEmail();
  return resolveEmailServiceUrl(email.url);
}

export function useEmailAdminEnabled(): boolean {
  const email = useShelluiEmail();
  return isEmailAdminEnabled(email);
}

export function useEmailApi(accessToken: string | null): {
  api: EmailApiClient | null;
  companyId: number | null;
  baseUrl: string;
  canManage: boolean;
} {
  const baseUrl = useEmailBaseUrl();
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const canManage = Boolean(
    accessToken && (getIsStaffFromJwt(accessToken) || getIsCompanyOwnerFromJwt(accessToken)),
  );
  const api = useMemo(() => {
    if (!accessToken || companyId == null) return null;
    return createEmailApiClient(baseUrl, accessToken, companyId);
  }, [accessToken, baseUrl, companyId]);
  return { api, companyId, baseUrl, canManage };
}
