import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import shellui from '@shellui/sdk';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import {
  OAuthCredentialsForm,
  type OAuthCredentialsFormValues,
} from '@/components/oauth/OAuthCredentialsForm';
import { OAuthProviderConsoleStep } from '@/components/oauth/OAuthProviderConsoleStep';
import { OAuthProviderPicker } from '@/components/oauth/OAuthProviderPicker';
import { OAuthProviderIconFromCatalog } from '@/components/oauth/OAuthProviderIcon';
import {
  buildOAuthCatalogIndex,
  catalogProviderForSocialApp,
  resolveSocialAppDocsSlug,
} from '@/lib/oauthProviderResolve';
import { OAuthWizardStepActions } from '@/components/oauth/OAuthWizardStepActions';
import { useDocumentColorScheme } from '@/hooks/useDocumentColorScheme';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { confirmAction } from '@/lib/confirmAction';
import { visibleCatalogProviders } from '@/lib/oauthCatalogDisplay';
import {
  OAuthApiRequestError,
  createOAuthSocialApp,
  deleteOAuthSocialApp,
  fetchOAuthProviderCatalog,
  fetchOAuthSocialApps,
  updateOAuthSocialApp,
  type OAuthSocialAppRow,
} from '@/lib/adminOauthClientsApi';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import { translateOAuthDuplicateError } from '@/lib/oauthDuplicateError';
import {
  isMultiInstanceCatalogProvider,
  linkedSocialAppsByDocsSlug,
  oauthWizardStepFromParam,
} from '@/lib/oauthSetupView';
import { getCompanyIdFromJwt, getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';

function emptyCredentials(): OAuthCredentialsFormValues {
  return { client_id: '', client_secret: '', tenant: '', extra_settings: {} };
}

function credentialsFromApp(
  provider: OAuthCatalogProvider,
  app: OAuthSocialAppRow,
): OAuthCredentialsFormValues {
  const extra: Record<string, string> = {};
  for (const field of provider.extra_settings_schema) {
    if (field.name === 'tenant') continue;
    const raw = app.extra_settings?.[field.name];
    if (typeof raw === 'string') extra[field.name] = raw;
    else if (raw != null) extra[field.name] = String(raw);
  }
  return {
    client_id: app.client_id ?? '',
    client_secret: '',
    tenant: app.tenant ?? '',
    extra_settings: extra,
  };
}

export function OAuthWizardRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useShelluiAccessToken();
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const colorScheme = useDocumentColorScheme();

  const routeDocsSlug = params.docsSlug?.trim().toLowerCase() || null;
  const editAppId = params.appId ? Number.parseInt(params.appId, 10) : null;
  const isEdit = editAppId != null && Number.isFinite(editAppId);

  const stepParam = searchParams.get('step');
  const stepFromUrl = oauthWizardStepFromParam(stepParam);
  const step = isEdit ? 'credentials' : (stepFromUrl ?? (routeDocsSlug ? 'console' : 'pick'));

  const [catalogProviders, setCatalogProviders] = useState<OAuthCatalogProvider[]>([]);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [socialApps, setSocialApps] = useState<OAuthSocialAppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorExistingAppId, setFormErrorExistingAppId] = useState<number | null>(null);
  const [credentials, setCredentials] = useState<OAuthCredentialsFormValues>(emptyCredentials());
  const [savedSummary, setSavedSummary] = useState<OAuthSocialAppRow | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !isOwner || companyId == null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [catalog, apps] = await Promise.all([
        fetchOAuthProviderCatalog(accessToken, companyId),
        fetchOAuthSocialApps(accessToken, companyId),
      ]);
      setCatalogProviders(visibleCatalogProviders(catalog.providers));
      setCallbackUrl(catalog.callback_url);
      setSocialApps(apps.social_apps);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('oauthSetupLoadError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, isOwner, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const catalogIndex = useMemo(() => buildOAuthCatalogIndex(catalogProviders), [catalogProviders]);

  const editingApp = useMemo(() => {
    if (!isEdit || !editAppId) return null;
    return socialApps.find((a) => a.id === editAppId) ?? null;
  }, [editAppId, isEdit, socialApps]);

  const effectiveDocsSlug =
    routeDocsSlug ?? (editingApp ? resolveSocialAppDocsSlug(editingApp) : null);
  const selectedProvider = editingApp
    ? catalogProviderForSocialApp(editingApp, catalogIndex)
    : effectiveDocsSlug
      ? catalogIndex.byDocsSlug.get(effectiveDocsSlug)
      : undefined;

  useEffect(() => {
    if (!isEdit || !editingApp || !selectedProvider) return;
    setCredentials(credentialsFromApp(selectedProvider, editingApp));
  }, [editingApp, isEdit, selectedProvider]);

  useEffect(() => {
    if (loading || isEdit || !selectedProvider || step === 'pick' || step === 'summary') return;
    if (isMultiInstanceCatalogProvider(selectedProvider)) return;
    const linked = linkedSocialAppsByDocsSlug(socialApps).get(
      selectedProvider.docs_slug.toLowerCase(),
    );
    if (linked?.length) {
      navigate(`/oauth/apps/${linked[0].id}/edit`, { replace: true });
    }
  }, [loading, isEdit, navigate, selectedProvider, socialApps, step]);

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

  if (isEdit && !loading && editingApp == null) {
    return (
      <Navigate
        to="/oauth"
        replace
      />
    );
  }

  if (isEdit && editingApp && !selectedProvider && !loading) {
    return (
      <Navigate
        to="/oauth"
        replace
      />
    );
  }

  async function onSave() {
    if (!accessToken || companyId == null || !selectedProvider) return;
    setBusy(true);
    setFormError(null);
    setFormErrorExistingAppId(null);
    setFieldErrors({});
    const extraPayload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(credentials.extra_settings)) {
      if (value.trim()) extraPayload[key] = value.trim();
    }
    try {
      if (isEdit && editingApp) {
        const payload: {
          client_id?: string;
          client_secret?: string;
          tenant?: string;
          extra_settings?: Record<string, unknown>;
        } = {};
        if (credentials.client_id.trim() !== editingApp.client_id) {
          payload.client_id = credentials.client_id.trim();
        }
        if (credentials.client_secret.trim()) {
          payload.client_secret = credentials.client_secret.trim();
        }
        if (credentials.tenant.trim() !== (editingApp.tenant ?? '')) {
          payload.tenant = credentials.tenant.trim();
        }
        if (Object.keys(extraPayload).length > 0) {
          payload.extra_settings = extraPayload;
        }
        if (Object.keys(payload).length === 0) {
          setFormError(t('oauthWizardNoChanges'));
          setBusy(false);
          return;
        }
        await updateOAuthSocialApp(accessToken, companyId, editingApp.id, payload);
        shellui.toast({ title: t('oauthWizardSavedToast'), type: 'success' });
        navigate('/oauth');
      } else {
        const created = await createOAuthSocialApp(accessToken, companyId, {
          docs_slug: selectedProvider.docs_slug,
          client_id: credentials.client_id.trim(),
          client_secret: credentials.client_secret.trim(),
          tenant: credentials.tenant.trim() || undefined,
          extra_settings: extraPayload,
        });
        setSavedSummary(created);
        setSearchParams({ step: 'summary' });
        await load();
      }
    } catch (e) {
      if (e instanceof OAuthApiRequestError) {
        if (e.isDuplicate) {
          setFormError(translateOAuthDuplicateError(t, e.errorCode));
          setFormErrorExistingAppId(e.existingSocialAppId);
        } else {
          setFormError(e.message);
          setFormErrorExistingAppId(null);
        }
        setFieldErrors(e.fieldErrors);
      } else {
        setFormError(e instanceof Error ? e.message : t('oauthSetupSaveError'));
        setFormErrorExistingAppId(null);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!accessToken || companyId == null || !editingApp) return;
    const ok = await confirmAction({
      title: t('oauthSetupDeleteAction'),
      description: t('oauthWizardDeleteConfirm'),
      okLabel: t('oauthSetupDeleteAction'),
      cancelLabel: t('oauthSetupDiscardCancel'),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteOAuthSocialApp(accessToken, companyId, editingApp.id);
      navigate('/oauth');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('oauthSetupDeleteError'));
    } finally {
      setBusy(false);
    }
  }

  const wizardTitle = isEdit ? t('oauthWizardEditTitle') : t('oauthWizardCreateTitle');
  const effectiveCallback = callbackUrl || selectedProvider?.callback_url || '';

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <div className="space-y-2">
          <Link
            to="/oauth"
            className="inline-flex items-center font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft
              className="mr-0.5 h-3.5 w-3.5"
              aria-hidden
            />
            {t('oauthWizardBackToList')}
          </Link>
          <div>
            <CardTitle className="font-heading text-lg">{wizardTitle}</CardTitle>
            <CardDescription className="font-mono text-xs">
              {isEdit ? t('oauthWizardEditStepsHint') : t('oauthWizardStepsHint')}
            </CardDescription>
          </div>
        </div>
        {!isEdit ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant={step === 'pick' ? 'default' : 'outline'}>
              1. {t('oauthWizardStepPick')}
            </Badge>
            <Badge variant={step === 'console' ? 'default' : 'outline'}>
              2. {t('oauthWizardStepConsole')}
            </Badge>
            <Badge variant={step === 'credentials' ? 'default' : 'outline'}>
              3. {t('oauthWizardStepCredentials')}
            </Badge>
            <Badge variant={step === 'summary' ? 'default' : 'outline'}>
              4. {t('oauthWizardStepSummary')}
            </Badge>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError ? <Text className="font-mono text-sm text-destructive">{loadError}</Text> : null}
        {loading ? (
          <Text className="font-mono text-sm text-muted-foreground">{t('oauthSetupLoading')}</Text>
        ) : null}

        {!loading && step === 'pick' && !isEdit ? (
          <OAuthProviderPicker
            providers={catalogProviders}
            socialApps={socialApps}
            colorScheme={colorScheme}
            onAdd={(provider) => {
              navigate(`/oauth/new/${provider.docs_slug}?step=console`);
            }}
            onOpenApp={(appId) => {
              navigate(`/oauth/apps/${appId}/edit`);
            }}
          />
        ) : null}

        {!loading && step === 'console' && selectedProvider && !isEdit ? (
          <OAuthProviderConsoleStep
            provider={selectedProvider}
            callbackUrl={callbackUrl}
            colorScheme={colorScheme}
            onBack={() => navigate('/oauth/new?step=pick')}
            onContinue={() => setSearchParams({ step: 'credentials' })}
          />
        ) : null}

        {!loading && step === 'credentials' && selectedProvider ? (
          <OAuthCredentialsForm
            provider={selectedProvider}
            mode={isEdit ? 'edit' : 'create'}
            values={credentials}
            onChange={setCredentials}
            fieldErrors={fieldErrors}
            formError={formError}
            formErrorExistingAppId={formErrorExistingAppId}
            busy={busy}
            callbackUrl={effectiveCallback}
            colorScheme={colorScheme}
            onBack={isEdit ? () => navigate('/oauth') : () => setSearchParams({ step: 'console' })}
            onSubmit={() => void onSave()}
            onDelete={isEdit ? () => void onDelete() : undefined}
          />
        ) : null}

        {!loading && step === 'summary' && savedSummary && selectedProvider && !isEdit ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <OAuthProviderIconFromCatalog
                provider={selectedProvider}
                size="lg"
                colorScheme={colorScheme}
              />
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  {t('oauthWizardSummaryTitle')}
                </h2>
                <Text className="font-mono text-xs text-muted-foreground">
                  {t('oauthWizardSummaryBody', { provider: selectedProvider.name })}
                </Text>
              </div>
            </div>
            <dl className="grid gap-2 font-mono text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t('oauthClientsClientId')}</dt>
                <dd className="break-all">{savedSummary.client_id}</dd>
              </div>
            </dl>
            <OAuthWizardStepActions
              backLabel={t('oauthWizardBackToList')}
              onBack={() => navigate('/oauth')}
              primaryLabel={t('oauthWizardAddAnother')}
              onPrimary={() => navigate('/oauth/new?step=pick')}
            />
          </div>
        ) : null}

        {!loading && routeDocsSlug && !selectedProvider && !isEdit ? (
          <Text className="font-mono text-sm text-destructive">
            {t('oauthWizardUnknownProvider')}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}
