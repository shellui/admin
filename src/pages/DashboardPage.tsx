import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function DashboardPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboardTitle')}</CardTitle>
          <CardDescription>{t('dashboardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">—</p>
        </CardContent>
      </Card>
    </div>
  );
}
