import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { DashboardCompanySection } from '@/components/DashboardCompanySection';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';

export function CompanyPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));

  return (
    <div className="w-full space-y-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('companyPageTitle')}
          </h1>
          <Badge variant="secondary" className="font-mono text-[10px] uppercase">
            {t('dashboardEnvBadge')}
          </Badge>
        </div>
        <Text className="max-w-3xl font-mono text-sm">{t('companyPageDescription')}</Text>
      </header>

      {!accessToken && (
        <Text className="font-mono text-sm text-muted-foreground">{t('dashboardNoSession')}</Text>
      )}

      {accessToken && !isOwner && (
        <Text className="max-w-3xl font-mono text-sm text-muted-foreground">
          {t('companyPageForbidden')}
        </Text>
      )}

      {accessToken && isOwner ? <DashboardCompanySection accessToken={accessToken} /> : null}
    </div>
  );
}
