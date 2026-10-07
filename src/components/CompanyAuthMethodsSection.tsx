import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2 text-lg">
          <KeyRound
            className="size-4 text-muted-foreground"
            aria-hidden
          />
          {t('authMethodsTitle')}
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          {t('authMethodsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <Loader2
              className="size-4 animate-spin"
              aria-hidden
            />
            {t('authMethodsLoading')}
          </div>
        ) : null}

        {error && isApiUnavailableError(error) ? (
          <ApiUnavailableNotice
            error={error}
            t={t}
          />
        ) : null}
        {error && !isApiUnavailableError(error) ? (
          <Text className="font-mono text-sm text-destructive">
            {error instanceof Error ? error.message : t('authMethodsLoadError')}
          </Text>
        ) : null}

        {!loading && data ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={data.magic_link_globally_enabled ? 'secondary' : 'outline'}>
                {data.magic_link_globally_enabled
                  ? t('authMethodsGlobalOn')
                  : t('authMethodsGlobalOff')}
              </Badge>
              <span className="font-mono text-[10px] text-muted-foreground">
                {t('authMethodsGlobalHint')}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t('authMethodsMagicLinkLabel')}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {t('authMethodsMagicLinkHint')}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {t('authMethodsEffective')}:{' '}
                  <span className="font-semibold">
                    {data.magic_link_effective
                      ? t('authMethodsEffectiveOn')
                      : t('authMethodsEffectiveOff')}
                  </span>
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={data.enable_magic_link ? 'secondary' : 'default'}
                disabled={saving || !data.magic_link_globally_enabled}
                onClick={() => void toggleMagicLink()}
              >
                {saving ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden
                    />
                    {t('authMethodsSaving')}
                  </>
                ) : data.enable_magic_link ? (
                  t('authMethodsDisableMagicLink')
                ) : (
                  t('authMethodsEnableMagicLink')
                )}
              </Button>
            </div>
            {!data.magic_link_globally_enabled ? (
              <Text className="font-mono text-[10px] text-muted-foreground">
                {t('authMethodsGlobalKillSwitch')}
              </Text>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
