import { useTranslation } from 'react-i18next';
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
      <div
        role="note"
        className="tone-destructive space-y-1 rounded-xl border p-4"
        data-testid="email-fallback-card"
      >
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{t('emailFallbackOffTitle')}</p>
          <p className="text-[13px] text-foreground">{t('emailFallbackOffBody')}</p>
        </div>
      </div>
    );
  }
  const capped = usage.limit > 0;
  const pct = capped ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  return (
    <div
      data-testid="email-fallback-card"
      role="note"
      className="tone-info space-y-3 rounded-xl border p-4"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{t('emailFallbackTitle')}</p>
        <p className="text-[13px] text-foreground">{t('emailFallbackBody')}</p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Text className="text-sm font-medium tabular-nums text-foreground">
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
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-foreground">
          {usage.recipientHourlyLimit > 0 ? (
            <li>{t('emailFallbackRecipient', { count: usage.recipientHourlyLimit })}</li>
          ) : null}
          <li>{t('emailFallbackReset')}</li>
          <li>{t('emailFallbackSender')}</li>
        </ul>
        <Text className="text-[13px] text-foreground">{t('emailFallbackAddOwn')}</Text>
      </div>
    </div>
  );
}
