import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/admin/PageHeader';
import { Text } from '@/components/ui/text';
import { CompanyAuthMethodsSection } from '@/components/CompanyAuthMethodsSection';
import { CompanyDesktopSchemesSection } from '@/components/CompanyDesktopSchemesSection';
import { DashboardCompanySection } from '@/components/DashboardCompanySection';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getIsCompanyOwnerFromJwt, getIsStaffFromJwt } from '@/lib/jwtCompany';

export function CompanyPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const isStaff = Boolean(accessToken && getIsStaffFromJwt(accessToken));
  const canEditSchemes = isOwner || isStaff;

  return (
    <div className="w-full space-y-8">
      <PageHeader
        title={t('companyPageTitle')}
        service={t('dashboardEnvBadge')}
        description={t('companyPageDescription')}
      />

      {!accessToken && (
        <Text className="text-sm text-muted-foreground">{t('dashboardNoSession')}</Text>
      )}

      {accessToken && !isOwner && !isStaff && (
        <Text className="max-w-3xl text-sm text-muted-foreground">{t('companyPageForbidden')}</Text>
      )}

      {accessToken && isOwner ? (
        <>
          <DashboardCompanySection accessToken={accessToken} />
          <CompanyAuthMethodsSection accessToken={accessToken} />
        </>
      ) : null}

      {accessToken ? (
        <CompanyDesktopSchemesSection
          accessToken={accessToken}
          canEdit={canEditSchemes}
        />
      ) : null}
    </div>
  );
}
