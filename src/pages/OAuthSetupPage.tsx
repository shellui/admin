import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import shellui from '@shellui/sdk';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import {
  createOAuthSocialApp,
  deleteOAuthSocialApp,
  fetchOAuthSocialApps,
  type OAuthSocialAppRow,
  updateOAuthSocialApp,
} from '@/lib/adminOauthClientsApi';
import { getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { getAuthBackendBaseUrl } from '@/lib/backendUrl';

const resolveShellUiOrigin = (): string => {
  if (typeof window === 'undefined') return '';
  if (window.parent !== window && typeof document.referrer === 'string' && document.referrer.trim()) {
    try {
      return new URL(document.referrer).origin;
    } catch {
      // Fall through to current origin.
    }
  }
  return window.location.origin;
};

export function OAuthSetupPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const [rows, setRows] = useState<OAuthSocialAppRow[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formClientId, setFormClientId] = useState('');
  const [formClientSecret, setFormClientSecret] = useState('');
  const [formTenant, setFormTenant] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');

  const load = useCallback(async () => {
    if (!accessToken || !isOwner) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const catalog = await fetchOAuthSocialApps(accessToken);
      const normalizedRows = Array.isArray(catalog.social_apps) ? catalog.social_apps : [];
      const normalizedProviders = Array.isArray(catalog.providers) ? catalog.providers : [];
      setRows(normalizedRows);
      setProviders(normalizedProviders);
      if (!Array.isArray(catalog.social_apps) || !Array.isArray(catalog.providers)) {
        setError(t('oauthSetupMalformedCatalog'));
      }
    } catch (e) {
      setRows([]);
      setProviders([]);
      setError(e instanceof Error ? e.message : t('oauthSetupLoadError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, isOwner, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const providerRows = useMemo(() => {
    const safeRows = Array.isArray(rows) ? rows : [];
    return providers.map((provider) => {
      const matches = safeRows.filter((row) => row?.provider?.toLowerCase() === provider.toLowerCase());
      const linked = matches.find((row) => row.is_linked) ?? null;
      return { provider, rows: matches, linked };
    });
  }, [providers, rows]);

  const selectedEntry = useMemo(
    () => providerRows.find((entry) => entry.provider === selectedProvider) ?? null,
    [providerRows, selectedProvider],
  );

  const selectedLinked = selectedEntry?.linked ?? null;
  const isCreateMode = !selectedLinked;
  const callbackUrl = useMemo(() => {
    if (!selectedProvider) return '';
    const baseOrigin = resolveShellUiOrigin();
    const callback = new URL('/login/callback', baseOrigin || getAuthBackendBaseUrl());
    callback.searchParams.set('provider', selectedProvider);
    if (selectedLinked?.mapping_id) {
      callback.searchParams.set('company_oauth_client_id', String(selectedLinked.mapping_id));
    }
    return callback.toString();
  }, [selectedLinked?.mapping_id, selectedProvider]);

  const initialFormSnapshot = useMemo(
    () => ({
      client_id: selectedLinked?.client_id ?? '',
      tenant: selectedLinked?.tenant ?? '',
    }),
    [selectedLinked],
  );

  const formDirty = useMemo(() => {
    if (formClientId.trim() !== (initialFormSnapshot.client_id || '').trim()) return true;
    if (formTenant.trim() !== (initialFormSnapshot.tenant || '').trim()) return true;
    if (formClientSecret.trim()) return true;
    return false;
  }, [formClientId, formClientSecret, formTenant, initialFormSnapshot.client_id, initialFormSnapshot.tenant]);

  useEffect(() => {
    if (!selectedProvider && providers.length > 0) {
      setSelectedProvider(providers[0]);
    } else if (selectedProvider && !providers.includes(selectedProvider) && providers.length > 0) {
      setSelectedProvider(providers[0]);
    }
  }, [providers, selectedProvider]);

  useEffect(() => {
    setFormClientId(selectedLinked?.client_id ?? '');
    setFormTenant(selectedLinked?.tenant ?? '');
    setFormClientSecret('');
  }, [selectedLinked?.id, selectedLinked?.client_id, selectedLinked?.tenant]);

  useEffect(() => {
    setCopyState('idle');
  }, [callbackUrl]);

  const confirmDiscardIfDirty = useCallback(async (): Promise<boolean> => {
    if (!formDirty) return true;
    if (typeof window === 'undefined' || window.parent === window) {
      return window.confirm(t('oauthSetupDiscardConfirm'));
    }
    return await new Promise<boolean>((resolve) => {
      shellui.dialog({
        title: t('oauthSetupDiscardTitle'),
        description: t('oauthSetupDiscardConfirm'),
        mode: 'confirm',
        okLabel: t('oauthSetupDiscardOk'),
        cancelLabel: t('oauthSetupDiscardCancel'),
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, [formDirty, t]);

  const handleSelectProvider = useCallback(
    async (provider: string) => {
      if (provider === selectedProvider) return;
      const shouldSwitch = await confirmDiscardIfDirty();
      if (!shouldSwitch) return;
      setSelectedProvider(provider);
      setError(null);
    },
    [confirmDiscardIfDirty, selectedProvider],
  );

  async function onCreateSocialApp() {
    if (!accessToken || !selectedProvider || !isCreateMode || !formClientId.trim() || !formClientSecret.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createOAuthSocialApp(accessToken, {
        provider: selectedProvider,
        client_id: formClientId.trim(),
        client_secret: formClientSecret.trim(),
        tenant: selectedProvider.toLowerCase() === 'microsoft' ? (formTenant.trim() || undefined) : undefined,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('oauthSetupSaveError'));
    } finally {
      setBusy(false);
    }
  }

  async function onUpdateSocialApp() {
    if (!accessToken || !selectedLinked || isCreateMode) return;
    const payload: { client_id?: string; client_secret?: string; tenant?: string } = {};
    if (formClientId.trim() !== (initialFormSnapshot.client_id || '').trim()) {
      payload.client_id = formClientId.trim();
    }
    if (selectedProvider.toLowerCase() === 'microsoft' && formTenant.trim() !== (initialFormSnapshot.tenant || '').trim()) {
      payload.tenant = formTenant.trim();
    }
    if (formClientSecret.trim()) {
      payload.client_secret = formClientSecret.trim();
    }
    if (Object.keys(payload).length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await updateOAuthSocialApp(accessToken, selectedLinked.id, payload);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('oauthSetupSaveError'));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteSocialApp(row: OAuthSocialAppRow) {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await deleteOAuthSocialApp(accessToken, row.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('oauthSetupDeleteError'));
    } finally {
      setBusy(false);
    }
  }

  const onCopyCallbackUrl = useCallback(async () => {
    if (!callbackUrl) return;
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
  }, [callbackUrl]);

  return (
    <div className="w-full space-y-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('oauthSetupPageTitle')}
          </h1>
          <Badge variant="secondary" className="font-mono text-[10px] uppercase">
            {t('dashboardEnvBadge')}
          </Badge>
        </div>
        <Text className="max-w-4xl font-mono text-sm">{t('oauthSetupPageDescription')}</Text>
      </header>

      {!accessToken && <Text className="font-mono text-sm text-muted-foreground">{t('dashboardNoSession')}</Text>}
      {accessToken && !isOwner && (
        <Text className="font-mono text-sm text-muted-foreground">{t('oauthSetupPageForbidden')}</Text>
      )}
      {error ? <Text className="font-mono text-sm text-destructive">{error}</Text> : null}

      {accessToken && isOwner ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t('oauthSetupCatalogTitle')}</CardTitle>
            <CardDescription className="font-mono text-xs">{t('oauthSetupCatalogDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Text className="font-mono text-sm text-muted-foreground">{t('oauthSetupLoading')}</Text> : null}
            {!loading && providers.length === 0 ? (
              <Text className="font-mono text-sm text-muted-foreground">{t('oauthSetupEmpty')}</Text>
            ) : null}
            {!loading && providers.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <aside className="space-y-2 border-r border-border pr-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t('oauthSetupProviderSidebar')}
                  </p>
                  <div className="space-y-1">
                    {providerRows.map((entry) => (
                      <button
                        key={entry.provider}
                        type="button"
                        className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left font-mono text-xs ${
                          entry.provider === selectedProvider
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted/60'
                        }`}
                        onClick={() => void handleSelectProvider(entry.provider)}
                      >
                        <span>{entry.provider}</span>
                        <Badge variant={entry.linked ? 'default' : 'outline'}>
                          {entry.linked ? t('oauthSetupStatusEnabled') : t('oauthSetupStatusNotInitialized')}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </aside>
                <section className="space-y-3">
                  <div className="space-y-2 rounded-md border border-border/70 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      OAuth callback URL
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      Configure this exact URL as an authorized redirect/callback URI in your OAuth provider app.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input value={callbackUrl} readOnly className="font-mono text-xs" />
                      <Button type="button" size="sm" variant="secondary" onClick={() => void onCopyCallbackUrl()}>
                        {copyState === 'done' ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    {copyState === 'error' ? (
                      <Text className="font-mono text-xs text-destructive">
                        Could not copy automatically. Copy the URL manually.
                      </Text>
                    ) : null}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {isCreateMode ? t('oauthSetupCreateHint') : t('oauthSetupEditHint')}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        {t('oauthClientsProvider')}
                      </label>
                      <Input value={selectedProvider} readOnly className="font-mono text-sm" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        {t('oauthSetupColClientId')}
                      </label>
                      <Input value={formClientId} onChange={(e) => setFormClientId(e.target.value)} className="font-mono text-sm" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        {t('oauthClientsClientSecret')}
                      </label>
                      <Input
                        type="password"
                        value={formClientSecret}
                        onChange={(e) => setFormClientSecret(e.target.value)}
                        className="font-mono text-sm"
                        autoComplete="new-password"
                        placeholder={isCreateMode ? '' : t('oauthSetupSecretPlaceholder')}
                      />
                    </div>
                    {selectedProvider.toLowerCase() === 'microsoft' ? (
                      <div className="space-y-1 sm:col-span-2">
                        <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          {t('oauthClientsTenant')}
                        </label>
                        <Input value={formTenant} onChange={(e) => setFormTenant(e.target.value)} className="font-mono text-sm" />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {isCreateMode ? (
                      <Button type="button" size="sm" disabled={busy || !selectedProvider || !formClientId.trim() || !formClientSecret.trim()} onClick={() => void onCreateSocialApp()}>
                        {busy ? t('oauthSetupCreateLoading') : t('oauthSetupCreateAction')}
                      </Button>
                    ) : (
                      <>
                        <Button type="button" size="sm" disabled={busy || !formDirty} onClick={() => void onUpdateSocialApp()}>
                          {busy ? t('oauthSetupSaveLoading') : t('oauthSetupSaveAction')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={busy || !selectedLinked}
                          onClick={() => selectedLinked && void onDeleteSocialApp(selectedLinked)}
                        >
                          {busy ? t('oauthSetupDeleteLoading') : t('oauthSetupDeleteAction')}
                        </Button>
                      </>
                    )}
                  </div>
                </section>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
