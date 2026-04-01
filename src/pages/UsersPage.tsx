import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function UsersPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('usersTitle')}</CardTitle>
          <CardDescription>{t('usersPlaceholder')}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
