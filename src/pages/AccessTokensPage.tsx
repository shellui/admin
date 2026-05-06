import { useTranslation } from 'react-i18next';
import { AccessTokensPanel } from '@/components/AccessTokensPanel';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { Text } from '@/components/ui/text';

export function AccessTokensPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {t('accessTokensPageTitle')}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t('accessTokensPageIntro')}</p>
      </header>

      {!accessToken ? (
        <Text className="text-sm text-muted-foreground">{t('usersNoSession')}</Text>
      ) : (
        <div className="rounded-lg border border-border/80 bg-card p-4 shadow-sm md:p-6">
          <AccessTokensPanel accessToken={accessToken} />
        </div>
      )}
    </div>
  );
}
