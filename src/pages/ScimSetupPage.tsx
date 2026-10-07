import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
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
import { confirmAction } from '@/lib/confirmAction';
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
    const confirmed = await confirmAction({
      title: t('scimRevokeTitle'),
      description: t('scimRevokeConfirm', { label }),
      okLabel: t('scimRevoke'),
      cancelLabel: t('scimRevokeCancel'),
      danger: true,
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

  return (
    <div className="w-full space-y-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('scimPageTitle')}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            {t('dashboardEnvBadge')}
          </Badge>
        </div>
        <Text className="max-w-4xl font-mono text-sm">{t('scimPageDescription')}</Text>
      </header>

      {!accessToken && (
        <Text className="font-mono text-sm text-muted-foreground">{t('dashboardNoSession')}</Text>
      )}
      {accessToken && !isOwner && (
        <Text className="font-mono text-sm text-muted-foreground">{t('scimPageForbidden')}</Text>
      )}

      {showDeploymentOff ? (
        <Text className="font-mono text-sm text-muted-foreground">
          {t('scimDeploymentUnavailable')}
        </Text>
      ) : null}

      {error && !isApiUnavailableError(error) ? (
        <Text className="font-mono text-sm text-destructive">
          {error instanceof Error ? error.message : t('scimLoadError')}
        </Text>
      ) : null}

      {showOwnerSetup ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t('scimTokensTitle')}</CardTitle>
            <CardDescription className="font-mono text-xs">
              {phase === 'no_token'
                ? t('scimTokensDescriptionNoToken')
                : phase === 'revoked_only'
                  ? t('scimTokensDescriptionRevoked')
                  : t('scimTokensDescriptionActive')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Text className="font-mono text-sm text-muted-foreground">{t('scimLoading')}</Text>
            ) : null}

            {!loading && phase === 'active' && config?.base_url ? (
              <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 p-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t('scimBaseUrlLabel')}
                </p>
                <Input
                  value={config.base_url}
                  readOnly
                  className="font-mono text-xs"
                />
                <Text className="font-mono text-xs text-muted-foreground">
                  {t('scimEndpointHint')}
                </Text>
              </div>
            ) : null}

            {createdSecret?.token ? (
              <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
                <p className="font-mono text-xs font-semibold text-amber-950 dark:text-amber-100">
                  {t('scimSecretOnceTitle')}
                </p>
                <Input
                  value={createdSecret.token}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void onCopySecret()}
                >
                  {copyState === 'done' ? t('scimSecretCopied') : t('scimSecretCopy')}
                </Button>
                {copyState === 'error' ? (
                  <Text className="font-mono text-xs text-destructive">
                    {t('scimSecretCopyError')}
                  </Text>
                ) : null}
              </div>
            ) : null}

            {!loading && phase === 'no_token' ? (
              <Text className="font-mono text-sm text-muted-foreground">{t('scimNoTokenYet')}</Text>
            ) : null}

            {activeTokens.length > 0 ? (
              <ul className="divide-y divide-border rounded-md border border-border">
                {activeTokens.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-mono text-xs">{row.label || t('scimTokenUnlabeled')}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {row.token_prefix}… · {row.created_at}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void onRevoke(row)}
                    >
                      {t('scimRevoke')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            {!loading && revokedTokens.length > 0 ? (
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t('scimRevokedSectionTitle')}
                </p>
                <ul className="divide-y divide-border rounded-md border border-border/80">
                  {revokedTokens.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 opacity-80"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-mono text-xs">{row.label || t('scimTokenUnlabeled')}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {row.token_prefix}…
                          {row.revoked_at
                            ? ` · ${t('scimRevokedAt', { date: row.revoked_at })}`
                            : null}
                        </p>
                      </div>
                      <Badge variant="outline">{t('scimRevokedBadge')}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-2 rounded-md border border-border/70 p-3">
              <p className="font-mono text-[10px] text-muted-foreground">{t('scimCreateHint')}</p>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={t('scimCreateLabelPlaceholder')}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                size="sm"
                disabled={busy || loading}
                onClick={() => void onCreateToken()}
              >
                {busy ? t('scimCreateLoading') : t('scimCreateAction')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
