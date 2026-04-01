import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function StandaloneNotice() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="font-heading">{t('standaloneTitle')}</CardTitle>
          <CardDescription>{t('standaloneDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>{t('standaloneStepRunShell')}</p>
          <p>{t('standaloneStepConfigure')}</p>
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 font-mono text-xs text-foreground">
            {t('standaloneConfigSnippet')}
          </pre>
          <p>{t('standaloneStepOpenAdmin')}</p>
          <p className="text-xs">{t('standaloneNoteUrl')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
