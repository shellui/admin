import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsSection } from '@/components/admin/SettingsSection';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import {
  ApiUnavailableNotice,
  isApiUnavailableError,
} from '@/features/actions/components/ApiUnavailableNotice';
import { fetchAuthMethods, patchAuthMethods, type AuthMethodsDto } from '@/lib/authMethodsApi';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

type Props = {
  accessToken: string;
};

export function CompanyAuthMethodsSection({ accessToken }: Props) {
  const { t } = useTranslation();
  const companyId = getCompanyIdFromJwt(accessToken);
  const [data, setData] = useState<AuthMethodsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    if (companyId == null) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAuthMethods(accessToken, companyId));
    } catch (e) {
      setData(null);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleMagicLink = useCallback(async () => {
    if (companyId == null || !data) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await patchAuthMethods(accessToken, companyId, {
        enable_magic_link: !data.enable_magic_link,
      });
      setData(updated);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }, [accessToken, companyId, data]);

  if (companyId == null) return null;

  return (
    <SettingsSection
      id="company-auth-methods"
      title={t('authMethodsTitle')}
      description={t('authMethodsDescription')}
      busy={loading}
    >
      {loading ? (
        <div className="space-y-2">
          <span className="sr-only">{t('authMethodsLoading')}</span>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-72" />
        </div>
      ) : null}

      {error && isApiUnavailableError(error) ? (
        <ApiUnavailableNotice
          error={error}
          t={t}
        />
      ) : null}
      {error && !isApiUnavailableError(error) ? (
        <Text className="text-sm text-destructive">
          {error instanceof Error ? error.message : t('authMethodsLoadError')}
        </Text>
      ) : null}

      {!loading && data ? (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="company-magic-link"
                className="text-sm font-medium"
              >
                {t('authMethodsMagicLinkLabel')}
              </label>
              <StatusBadge tone={data.magic_link_effective ? 'success' : 'muted'}>
                {t('authMethodsEffective')}:{' '}
                {data.magic_link_effective
                  ? t('authMethodsEffectiveOn')
                  : t('authMethodsEffectiveOff')}
              </StatusBadge>
              <StatusBadge tone={data.magic_link_globally_enabled ? 'info' : 'warning'}>
                {data.magic_link_globally_enabled
                  ? t('authMethodsGlobalOn')
                  : t('authMethodsGlobalOff')}
              </StatusBadge>
            </div>
            <p className="text-xs text-muted-foreground">{t('authMethodsMagicLinkHint')}</p>
            <p className="text-xs text-muted-foreground">{t('authMethodsGlobalHint')}</p>
            {!data.magic_link_globally_enabled ? (
              <p className="text-xs text-muted-foreground">{t('authMethodsGlobalKillSwitch')}</p>
            ) : null}
          </div>
          <Switch
            id="company-magic-link"
            checked={data.enable_magic_link}
            disabled={saving || !data.magic_link_globally_enabled}
            aria-label={
              data.enable_magic_link
                ? t('authMethodsDisableMagicLink')
                : t('authMethodsEnableMagicLink')
            }
            onCheckedChange={() => void toggleMagicLink()}
          />
        </div>
      ) : null}
    </SettingsSection>
  );
}
