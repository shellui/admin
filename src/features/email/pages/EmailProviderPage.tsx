import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
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

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('emailProviderTitle')}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            email-service
          </Badge>
          {statusLabel ? (
            <Badge variant={settings?.configured ? 'default' : 'muted'}>{statusLabel}</Badge>
          ) : null}
        </div>
        <Text className="max-w-3xl">{t('emailProviderDescription')}</Text>
        <Text className="font-mono text-xs text-muted-foreground">{baseUrl}</Text>
      </header>
      {!accessToken ? <Text>{t('dashboardNoSession')}</Text> : null}
      {accessToken && !canManage ? <Text>{t('emailForbidden')}</Text> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('emailLoading')}
        </div>
      ) : null}
      {error ? (
        <Text className="font-mono text-sm text-destructive">{emailErrorText(t, error)}</Text>
      ) : null}
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
