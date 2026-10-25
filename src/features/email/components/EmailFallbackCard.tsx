import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import type { EmailProviderSettings } from '@/lib/emailTypes';

/** Shown when the project has no provider: explains the Shellui fallback and its caps. */
export function EmailFallbackCard({ settings }: { settings: EmailProviderSettings }) {
  const { t } = useTranslation();
  const usage = settings.fallbackUsage;
  if (settings.configured || !usage?.applies) return null;
  const off =
    usage.disabled || !settings.fallbackConfigured || settings.fallbackProvider === 'none';
  if (off) {
    return (
      <Card
        className="border-destructive/40"
        data-testid="email-fallback-card"
      >
        <CardHeader>
          <CardTitle>{t('emailFallbackOffTitle')}</CardTitle>
          <CardDescription>{t('emailFallbackOffBody')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const capped = usage.limit > 0;
  const pct = capped ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  return (
    <Card data-testid="email-fallback-card">
      <CardHeader>
        <CardTitle>{t('emailFallbackTitle')}</CardTitle>
        <CardDescription>{t('emailFallbackBody')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Text className="font-mono text-sm">
            {capped
              ? t('emailFallbackUsed', { used: usage.used, limit: usage.limit })
              : t('emailFallbackUsedNoCap', { used: usage.used })}
          </Text>
          {capped ? (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={usage.limit}
              aria-valuenow={usage.used}
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={pct >= 100 ? 'h-full bg-destructive' : 'h-full bg-primary'}
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : null}
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {usage.recipientHourlyLimit > 0 ? (
            <li>{t('emailFallbackRecipient', { count: usage.recipientHourlyLimit })}</li>
          ) : null}
          <li>{t('emailFallbackReset')}</li>
          <li>{t('emailFallbackSender')}</li>
        </ul>
        <Text className="text-sm">{t('emailFallbackAddOwn')}</Text>
      </CardContent>
    </Card>
  );
}
