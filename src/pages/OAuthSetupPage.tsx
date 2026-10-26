import { useCallback, useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTableCard } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { OAuthAppsTable } from '@/components/oauth/OAuthAppsTable';
import { useDocumentColorScheme } from '@/hooks/useDocumentColorScheme';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import {
  fetchOAuthProviderCatalog,
  fetchOAuthSocialApps,
  type OAuthSocialAppRow,
} from '@/lib/adminOauthClientsApi';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { getCompanyIdFromJwt, getIsCompanyOwnerFromJwt, getIsStaffFromJwt } from '@/lib/jwtCompany';
import { OAuthRedirectsSection } from '@/pages/oauth/OAuthRedirectsSection';
import { OAuthWizardRoute } from '@/pages/oauth/OAuthWizardRoute';

function OAuthAppsListPanel() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const isStaff = Boolean(accessToken && getIsStaffFromJwt(accessToken));
  const canManage = isOwner || isStaff;
  const colorScheme = useDocumentColorScheme();

  const [rows, setRows] = useState<OAuthSocialAppRow[]>([]);
  const [catalogProviders, setCatalogProviders] = useState<OAuthCatalogProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !canManage || companyId == null) {
      setRows([]);
      setCatalogProviders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [catalog, apps] = await Promise.all([
        fetchOAuthProviderCatalog(accessToken, companyId, { includeLegacy: false }),
        fetchOAuthSocialApps(accessToken, companyId),
      ]);
      setCatalogProviders(catalog.providers);
      setRows(apps.social_apps);
    } catch (e) {
      setRows([]);
      setCatalogProviders([]);
      setError(e instanceof Error ? e.message : t('oauthSetupLoadError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, canManage, companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!accessToken) {
    return (
      <Alert>
        <AlertDescription>{t('dashboardNoSession')}</AlertDescription>
      </Alert>
    );
  }
  if (!canManage || companyId == null) {
    return (
      <Alert>
        <AlertDescription>{t('oauthSetupPageForbidden')}</AlertDescription>
      </Alert>
    );
  }

  const linkedCount = rows.filter((r) => r.is_linked).length;
  return (
    <>
      <DataTableCard
        label={t('oauthSetupCatalogTitle')}
        busy={loading}
        toolbar={
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold">{t('oauthSetupCatalogTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('oauthSetupCatalogDescription')}</p>
          </div>
        }
        footer={
          linkedCount > 0 && !loading ? (
            <div className="flex justify-end">
              <Button asChild>
                <Link to="/oauth/new">
                  <Plus aria-hidden />
                  {t('oauthWizardAddProvider')}
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      >
        {error ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{error}</span>
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
          </div>
        ) : loading ? (
          <div className="space-y-2 p-4">
            <span className="sr-only">{t('oauthSetupLoading')}</span>
            {[0, 1, 2].map((i) => (
              <Skeleton
                key={i}
                className="h-9 w-full"
              />
            ))}
          </div>
        ) : linkedCount === 0 ? (
          <EmptyState
            icon={KeyRound}
            title={t('oauthWizardAppsEmpty')}
            actions={
              <Button asChild>
                <Link to="/oauth/new">
                  <Plus aria-hidden />
                  {t('oauthWizardAddProvider')}
                </Link>
              </Button>
            }
          />
        ) : (
          <OAuthAppsTable
            rows={rows}
            catalogProviders={catalogProviders}
            colorScheme={colorScheme}
          />
        )}
      </DataTableCard>
      <OAuthRedirectsSection accessToken={accessToken} />
    </>
  );
}

export function OAuthSetupPage() {
  const { t } = useTranslation();

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('oauthSetupPageTitle')}
        service={t('dashboardEnvBadge')}
        description={t('oauthSetupPageDescription')}
      />
      <Routes>
        <Route
          index
          element={<OAuthAppsListPanel />}
        />
        <Route
          path="new"
          element={<OAuthWizardRoute />}
        />
        <Route
          path="new/:docsSlug"
          element={<OAuthWizardRoute />}
        />
        <Route
          path="apps/:appId/edit"
          element={<OAuthWizardRoute />}
        />
      </Routes>
    </div>
  );
}
