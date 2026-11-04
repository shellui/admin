import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { SettingsSection } from '@/components/admin/SettingsSection';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AiServiceNotConfiguredError, isAiAdminEnabled } from '@/lib/aiServiceUrl';
import { fetchAiServiceHealthLive, type AiServiceHealthSnapshot } from '@/lib/aiServiceHealthApi';
import { aiServiceMcpEndpointUrl } from '@/lib/companyAgentsMcpConfig';
import { useShelluiAiService } from '@/hooks/useShelluiAiService';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

export function AiStatusPage() {
  const { t } = useTranslation();
  const aiSettings = useShelluiAiService();
  const aiUrl = isAiAdminEnabled(aiSettings) ? (aiSettings?.url ?? null) : null;
  const accessToken = useShelluiAccessToken();
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const mcpEndpoint = aiUrl ? aiServiceMcpEndpointUrl(aiUrl, companyId) : '';

  const [snapshot, setSnapshot] = useState<AiServiceHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!aiUrl) return;
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchAiServiceHealthLive());
    } catch (e) {
      if (e instanceof AiServiceNotConfiguredError) {
        setError(t('agentsConnectMissingUrl'));
      } else {
        setError(e instanceof Error ? e.message : t('aiStatusLoadError'));
      }
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [aiUrl, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!aiUrl) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={t('aiStatusTitle')}
          service={t('navAiGroup')}
        />
        <Alert>
          <AlertTitle>{t('aiMissingTitle')}</AlertTitle>
          <AlertDescription>{t('agentsConnectMissingUrl')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t('aiStatusTitle')}
        service={t('navAiGroup')}
        description={t('aiStatusDescription')}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2
                className="size-4 animate-spin"
                aria-hidden
              />
            ) : (
              <RefreshCw
                className="size-4"
                aria-hidden
              />
            )}
            {t('aiStatusRefresh')}
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <SettingsSection
        id="ai-status"
        title={t('aiStatusSectionTitle')}
        description={aiUrl}
      >
        <dl className="grid gap-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-muted-foreground">{t('aiStatusLiveLabel')}</dt>
            <dd>
              {loading && !snapshot ? (
                <span className="text-muted-foreground">{t('aiStatusLoading')}</span>
              ) : snapshot ? (
                <StatusBadge tone={snapshot.status === 'ok' ? 'success' : 'destructive'}>
                  {snapshot.status}
                </StatusBadge>
              ) : (
                '-'
              )}
            </dd>
          </div>
          {snapshot?.version ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t('aiStatusVersionLabel')}</dt>
              <dd className="font-mono text-xs">{snapshot.version}</dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{t('agentsConnectTitle')}</dt>
            <dd className="break-all font-mono text-xs text-foreground">{mcpEndpoint || '-'}</dd>
          </div>
        </dl>
      </SettingsSection>
    </div>
  );
}
