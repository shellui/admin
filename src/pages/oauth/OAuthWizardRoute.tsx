import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft } from 'lucide-react';
import shellui from '@shellui/sdk';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
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
import { getCompanyIdFromJwt, getIsCompanyOwnerFromJwt, getIsStaffFromJwt } from '@/lib/jwtCompany';

function emptyCredentials(): OAuthCredentialsFormValues {
  return {
    client_id: '',
    client_secret: '',
    tenant: '',
    extra_settings: {},
  };
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
  const isStaff = Boolean(accessToken && getIsStaffFromJwt(accessToken));
  const canManage = isOwner || isStaff;
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
    if (!accessToken || !canManage || companyId == null) {
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
  }, [accessToken, canManage, companyId, t]);

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
    const ok = await askShelluiConfirm({
      title: t('oauthSetupDeleteAction'),
      description: t('oauthWizardDeleteConfirm'),
      okLabel: t('oauthSetupDeleteAction'),
      cancelLabel: t('oauthSetupDiscardCancel'),
      mode: 'delete',
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

  const stepKeys = ['pick', 'console', 'credentials', 'summary'] as const;
  const stepIndex = stepKeys.indexOf(step as (typeof stepKeys)[number]);
  const stepLabels = {
    pick: t('oauthWizardStepPick'),
    console: t('oauthWizardStepConsole'),
    credentials: t('oauthWizardStepCredentials'),
    summary: t('oauthWizardStepSummary'),
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="space-y-3 border-b border-border px-4 py-4 sm:px-5">
        <Link
          to="/oauth"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft
            className="size-4"
            aria-hidden
          />
          {t('oauthWizardBackToList')}
        </Link>
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold">{wizardTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {isEdit ? t('oauthWizardEditStepsHint') : t('oauthWizardStepsHint')}
          </p>
        </div>
        {!isEdit ? (
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 pt-1 text-sm">
            {stepKeys.map((key, i) => {
              const done = i < stepIndex;
              const current = i === stepIndex;
              return (
                <li
                  key={key}
                  className="flex items-center gap-2"
                  aria-current={current ? 'step' : undefined}
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full border text-xs font-medium tabular-nums',
                      current && 'border-primary bg-primary text-primary-foreground',
                      done && 'border-primary text-primary-ink',
                      !current && !done && 'border-border text-muted-foreground',
                    )}
                  >
                    {done ? (
                      <Check
                        className="size-3.5"
                        aria-hidden
                      />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className={current ? 'font-medium' : 'text-muted-foreground'}>
                    {stepLabels[key]}
                  </span>
                  {i < stepKeys.length - 1 ? (
                    <span
                      aria-hidden
                      className="mx-1 hidden h-px w-6 bg-border sm:inline-block"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}
        {loading ? (
          <div className="space-y-3">
            <span className="sr-only">{t('oauthSetupLoading')}</span>
            <Skeleton className="h-9 w-full" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  className="h-24"
                />
              ))}
            </div>
          </div>
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
                <p className="text-sm text-muted-foreground">
                  {t('oauthWizardSummaryBody', { provider: selectedProvider.name })}
                </p>
              </div>
            </div>
            <dl className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t('oauthClientsClientId')}</dt>
                <dd className="break-all font-mono text-xs">{savedSummary.client_id}</dd>
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
          <Alert variant="destructive">
            <AlertDescription>{t('oauthWizardUnknownProvider')}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </section>
  );
}
