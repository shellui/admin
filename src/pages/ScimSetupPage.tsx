import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, KeyRound, Loader2, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SettingsSection } from '@/components/admin/SettingsSection';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { isApiUnavailableError } from '@/features/actions/components/ApiUnavailableNotice';
import {
  createScimToken,
  fetchScimConfig,
  fetchScimTokens,
  revokeScimToken,
  type ScimConfig,
  type ScimTokenCreateResponse,
  type ScimTokenRow,
} from '@/lib/scimApi';
import {
  isScimDeploymentAvailable,
  partitionScimTokens,
  scimSetupPhase,
} from '@/lib/scimSetupView';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import { getCompanyIdFromJwt, getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import shellui from '@shellui/sdk';

export function ScimSetupPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;

  const [config, setConfig] = useState<ScimConfig | null>(null);
  const [allTokens, setAllTokens] = useState<ScimTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [createdSecret, setCreatedSecret] = useState<ScimTokenCreateResponse | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');

  const { active: activeTokens, revoked: revokedTokens } = useMemo(
    () => partitionScimTokens(allTokens),
    [allTokens],
  );

  const deploymentAvailable = isScimDeploymentAvailable(config);
  const apiUnavailable = Boolean(error && isApiUnavailableError(error));
  const showDeploymentOff = apiUnavailable || (!loading && config != null && !deploymentAvailable);
  const phase = scimSetupPhase({
    loading,
    deploymentAvailable: deploymentAvailable && !apiUnavailable,
    activeCount: activeTokens.length,
    revokedCount: revokedTokens.length,
  });

  const load = useCallback(async () => {
    if (!accessToken || !isOwner || companyId == null) {
      setLoading(false);
      setConfig(null);
      setAllTokens([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [cfg, rows] = await Promise.all([
        fetchScimConfig(accessToken, companyId),
        fetchScimTokens(accessToken, companyId),
      ]);
      setConfig(cfg);
      setAllTokens(rows);
    } catch (e) {
      setConfig(null);
      setAllTokens([]);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreateToken() {
    if (!accessToken || companyId == null) return;
    setBusy(true);
    setError(null);
    setCreatedSecret(null);
    try {
      const created = await createScimToken(accessToken, companyId, {
        label: newLabel.trim() || undefined,
      });
      setCreatedSecret(created);
      setNewLabel('');
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(row: ScimTokenRow) {
    if (!accessToken || companyId == null) return;
    const label = row.label || row.token_prefix;
    const confirmed = await askShelluiConfirm({
      title: t('scimRevokeTitle'),
      description: t('scimRevokeConfirm', { label }),
      okLabel: t('scimRevoke'),
      cancelLabel: t('scimRevokeCancel'),
      mode: 'delete',
    });
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await revokeScimToken(accessToken, companyId, row.id);
      shellui.toast({ title: t('scimRevoked'), type: 'success' });
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function onCopySecret() {
    if (!createdSecret?.token) return;
    try {
      await navigator.clipboard.writeText(createdSecret.token);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
  }

  const showOwnerSetup = accessToken && isOwner && companyId != null && !showDeploymentOff;

  const card = 'overflow-hidden rounded-xl border border-border bg-card shadow-xs';
  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('scimPageTitle')}
        service={t('dashboardEnvBadge')}
        description={t('scimPageDescription')}
      />

      {!accessToken ? (
        <Alert>
          <AlertDescription>{t('dashboardNoSession')}</AlertDescription>
        </Alert>
      ) : null}
      {accessToken && !isOwner ? (
        <Alert>
          <AlertDescription>{t('scimPageForbidden')}</AlertDescription>
        </Alert>
      ) : null}
      {showDeploymentOff ? (
        <Alert variant="warning">
          <AlertDescription>{t('scimDeploymentUnavailable')}</AlertDescription>
        </Alert>
      ) : null}
      {error && !isApiUnavailableError(error) ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error instanceof Error ? error.message : t('scimLoadError')}</span>
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

      {showOwnerSetup && loading ? (
        <div
          className={card + ' space-y-3 p-5'}
          aria-busy
        >
          <span className="sr-only">{t('scimLoading')}</span>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : null}

      {showOwnerSetup && !loading && phase === 'active' && config?.base_url ? (
        <SettingsSection
          title={t('scimBaseUrlLabel')}
          description={t('scimEndpointHint')}
        >
          <CopyRow value={config.base_url} />
        </SettingsSection>
      ) : null}

      {showOwnerSetup && !loading ? (
        <section className={card}>
          <div className="space-y-1 border-b border-border px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold">{t('scimTokensTitle')}</h2>
            <p className="text-xs text-muted-foreground">
              {phase === 'no_token'
                ? t('scimTokensDescriptionNoToken')
                : phase === 'revoked_only'
                  ? t('scimTokensDescriptionRevoked')
                  : t('scimTokensDescriptionActive')}
            </p>
          </div>

          {createdSecret?.token ? (
            <div className="border-b border-border p-4 sm:px-5">
              <Alert variant="gold">
                <KeyRound aria-hidden />
                <AlertDescription className="space-y-2">
                  <p className="font-medium">{t('scimSecretOnceTitle')}</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={createdSecret.token}
                      readOnly
                      aria-label={t('scimSecretOnceTitle')}
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void onCopySecret()}
                    >
                      {copyState === 'done' ? <Check aria-hidden /> : <Copy aria-hidden />}
                      {copyState === 'done' ? t('scimSecretCopied') : t('scimSecretCopy')}
                    </Button>
                  </div>
                  {copyState === 'error' ? (
                    <p className="text-xs text-destructive">{t('scimSecretCopyError')}</p>
                  ) : null}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          {phase === 'no_token' ? (
            <EmptyState
              icon={KeyRound}
              title={t('scimNoTokenYet')}
            />
          ) : null}

          {activeTokens.length > 0 ? (
            <ul className="divide-y divide-border">
              {activeTokens.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium">{row.label || t('scimTokenUnlabeled')}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.token_prefix}... · {row.created_at}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => void onRevoke(row)}
                  >
                    {t('scimRevoke')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-end sm:px-5">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="scim-new-label">{t('scimCreateHint')}</Label>
              <Input
                id="scim-new-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={t('scimCreateLabelPlaceholder')}
              />
            </div>
            <Button
              type="button"
              disabled={busy || loading}
              onClick={() => void onCreateToken()}
            >
              {busy ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Plus aria-hidden />
              )}
              {busy ? t('scimCreateLoading') : t('scimCreateAction')}
            </Button>
          </div>
        </section>
      ) : null}

      {showOwnerSetup && !loading && revokedTokens.length > 0 ? (
        <section className={card}>
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold sm:px-5">
            {t('scimRevokedSectionTitle')}
          </h2>
          <ul className="divide-y divide-border">
            {revokedTokens.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-muted-foreground sm:px-5"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm">{row.label || t('scimTokenUnlabeled')}</p>
                  <p className="font-mono text-xs">
                    {row.token_prefix}...
                    {row.revoked_at ? ` · ${t('scimRevokedAt', { date: row.revoked_at })}` : null}
                  </p>
                </div>
                <StatusBadge tone="muted">{t('scimRevokedBadge')}</StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function CopyRow({ value }: { value: string }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        readOnly
        aria-label={t('scimBaseUrlLabel')}
        className="font-mono text-xs"
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          void navigator.clipboard
            .writeText(value)
            .then(() => setDone(true))
            .catch(() => setDone(false));
        }}
      >
        {done ? <Check aria-hidden /> : <Copy aria-hidden />}
        {done ? t('scimSecretCopied') : t('oauthWizardCopy')}
      </Button>
    </div>
  );
}
