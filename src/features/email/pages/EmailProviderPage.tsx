import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { EmailFallbackCard } from '@/features/email/components/EmailFallbackCard';
import { EmailProviderForm } from '@/features/email/components/EmailProviderForm';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { emailErrorText } from '@/lib/emailApiErrors';
import { getEmailFromJwt, getIsStaffFromJwt } from '@/lib/jwtCompany';
import type { EmailProviderSettings } from '@/lib/emailTypes';

export function EmailProviderPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const { api, baseUrl, canManage } = useEmailApi(accessToken);
  const [settings, setSettings] = useState<EmailProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    if (!api || !canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSettings(await api.fetchProvider());
    } catch (err) {
      setSettings(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [api, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusLabel = !settings
    ? null
    : settings.configured
      ? t('emailProviderConfigured')
      : settings.fallbackConfigured
        ? t('emailProviderUsingFallback')
        : t('emailProviderNotConfigured');

  const statusTone = !settings
    ? 'muted'
    : settings.configured
      ? 'success'
      : settings.fallbackConfigured
        ? 'warning'
        : 'muted';

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('emailProviderTitle')}
        service="email-service"
        description={t('emailProviderPageDescription')}
        actions={
          statusLabel ? <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge> : undefined
        }
      />
      {baseUrl ? <p className="-mt-3 font-mono text-xs text-muted-foreground">{baseUrl}</p> : null}
      {!accessToken ? (
        <Alert variant="info">
          <AlertDescription>{t('dashboardNoSession')}</AlertDescription>
        </Alert>
      ) : null}
      {accessToken && !canManage ? (
        <Alert variant="info">
          <AlertDescription>{t('emailForbidden')}</AlertDescription>
        </Alert>
      ) : null}
      {loading ? (
        <div
          className="space-y-6 motion-safe:animate-pulse"
          aria-busy
        >
          <span className="sr-only">{t('emailLoading')}</span>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)] md:gap-8"
              aria-hidden
            >
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-44" />
              </div>
              <div className="space-y-3 rounded-xl border border-border bg-card p-5">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{emailErrorText(t, error)}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void load()}
            >
              {t('usersRetry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {settings ? <EmailFallbackCard settings={settings} /> : null}
      {settings && api ? (
        <EmailProviderForm
          settings={settings}
          jwtEmail={accessToken ? getEmailFromJwt(accessToken) : null}
          isStaff={Boolean(accessToken && getIsStaffFromJwt(accessToken))}
          saving={saving}
          testing={testing}
          onSave={async (body) => {
            setSaving(true);
            try {
              setSettings(await api.saveProvider(body));
            } finally {
              setSaving(false);
            }
          }}
          onTest={async (to) => {
            setTesting(true);
            try {
              await api.testProvider(to);
            } finally {
              setTesting(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
