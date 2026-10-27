import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/admin/PageHeader';
import { AccessTokensPanel } from '@/components/AccessTokensPanel';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';

export function AccessTokensPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('accessTokensPageTitle')}
        service={t('usersSchemaBadge')}
        description={t('accessTokensPageIntro')}
      />
      <AccessTokensPanel accessToken={accessToken} />
    </div>
  );
}
