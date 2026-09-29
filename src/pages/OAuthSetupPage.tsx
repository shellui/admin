import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { OAuthAppsTable } from '@/components/oauth/OAuthAppsTable';
import { useDocumentColorScheme } from '@/hooks/useDocumentColorScheme';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import {
  fetchOAuthProviderCatalog,
  fetchOAuthSocialApps,
  type OAuthSocialAppRow,
} from '@/lib/adminOauthClientsApi';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { getCompanyIdFromJwt, getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { OAuthRedirectsSection } from '@/pages/oauth/OAuthRedirectsSection';
import { OAuthWizardRoute } from '@/pages/oauth/OAuthWizardRoute';

function OAuthAppsListPanel() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const colorScheme = useDocumentColorScheme();

  const [rows, setRows] = useState<OAuthSocialAppRow[]>([]);
  const [catalogProviders, setCatalogProviders] = useState<OAuthCatalogProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !isOwner || companyId == null) {
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
  }, [accessToken, companyId, isOwner, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const catalogBySlug = useMemo(() => {
    const map = new Map<string, OAuthCatalogProvider>();
    for (const p of catalogProviders) map.set(p.docs_slug, p);
    return map;
  }, [catalogProviders]);

  if (!accessToken) {
    return (
      <Text className="font-mono text-sm text-muted-foreground">{t('dashboardNoSession')}</Text>
    );
  }
  if (!isOwner || companyId == null) {
    return (
      <Text className="font-mono text-sm text-muted-foreground">
        {t('oauthSetupPageForbidden')}
      </Text>
    );
  }

  return (
    <>
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="font-heading text-lg">{t('oauthSetupCatalogTitle')}</CardTitle>
              <CardDescription className="font-mono text-xs">
                {t('oauthSetupCatalogDescription')}
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              asChild
            >
              <Link to="/oauth/new">{t('oauthWizardAddProvider')}</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <Text className="font-mono text-sm text-destructive">{error}</Text> : null}
          {loading ? (
            <Text className="font-mono text-sm text-muted-foreground">
              {t('oauthSetupLoading')}
            </Text>
          ) : (
            <OAuthAppsTable
              rows={rows}
              catalogBySlug={catalogBySlug}
              colorScheme={colorScheme}
            />
          )}
        </CardContent>
      </Card>
      <OAuthRedirectsSection accessToken={accessToken} />
    </>
  );
}

export function OAuthSetupPage() {
  const { t } = useTranslation();

  return (
    <div className="w-full space-y-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('oauthSetupPageTitle')}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            {t('dashboardEnvBadge')}
          </Badge>
        </div>
        <Text className="max-w-4xl font-mono text-sm">{t('oauthSetupPageDescription')}</Text>
      </header>

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
