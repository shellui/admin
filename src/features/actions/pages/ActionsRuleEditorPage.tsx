import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import shellui from '@shellui/sdk';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { ActionsSubNav } from '@/features/actions/components/ActionsSubNav';
import { WebhookSecretOnceCallout } from '@/features/actions/components/WebhookSecretOnceCallout';
import {
  ApiUnavailableNotice,
  isApiUnavailableError,
} from '@/features/actions/components/ApiUnavailableNotice';
import { useActionsApi } from '@/features/actions/useActionsApi';
import type { ActionEventCatalogEntry, ActionRuleWebhookConfig } from '@/features/actions/types';

function formatSampleEnvelope(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

type LocationSecretState = {
  revealedSecret?: string;
};

function ruleHasStoredSecret(cfg: ActionRuleWebhookConfig): boolean {
  return cfg.has_secret === true || cfg.secret_set === true;
}

export function ActionsRuleEditorPage() {
  const { t } = useTranslation();
  const { ruleId } = useParams();
  const isCreate = ruleId === 'new' || !ruleId;
  const numericId = !isCreate && ruleId ? Number.parseInt(ruleId, 10) : null;
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const { api } = useActionsApi(accessToken);

  const [events, setEvents] = useState<ActionEventCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotateLoading, setRotateLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sendTestLoading, setSendTestLoading] = useState(false);
  const [sendTestFeedback, setSendTestFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [storedSecretHint, setStoredSecretHint] = useState<string | null>(null);
  const [hasStoredSecret, setHasStoredSecret] = useState(false);

  const [name, setName] = useState('');
  const [eventKey, setEventKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [authHeaderName, setAuthHeaderName] = useState('');
  const [authHeaderValue, setAuthHeaderValue] = useState('');

  const selectedEvent = useMemo(
    () => events.find((e) => e.key === eventKey) ?? null,
    [events, eventKey],
  );

  const sampleEnvelopeText = useMemo(
    () => formatSampleEnvelope(selectedEvent?.sample_envelope),
    [selectedEvent?.sample_envelope],
  );

  const deliveryLogHref =
    numericId != null
      ? `/webhooks/deliveries?action_rule_id=${encodeURIComponent(String(numericId))}`
      : '/webhooks/deliveries';

  const applyRuleConfigMeta = useCallback((cfg: ActionRuleWebhookConfig) => {
    setHasStoredSecret(ruleHasStoredSecret(cfg));
    setStoredSecretHint(cfg.secret_hint?.trim() || null);
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!api || !isOwner) return [];
    return api.fetchEvents();
  }, [api, isOwner]);

  const loadRule = useCallback(async () => {
    if (!api || !isOwner || numericId == null || !Number.isFinite(numericId)) return null;
    return api.fetchRule(numericId);
  }, [api, isOwner, numericId]);

  useEffect(() => {
    const navState = location.state as LocationSecretState | null;
    if (navState?.revealedSecret?.trim()) {
      setRevealedSecret(navState.revealedSecret.trim());
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!api || !isOwner) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const catalog = await loadCatalog();
        if (cancelled) return;
        setEvents(catalog);
        if (isCreate && catalog[0]?.key) setEventKey(catalog[0].key);

        if (!isCreate && numericId != null) {
          const rule = await loadRule();
          if (cancelled || !rule) return;
          setName(rule.name);
          setEventKey(rule.event);
          setEnabled(rule.enabled);
          const cfg = rule.config;
          setWebhookUrl(cfg.url ?? '');
          setAuthHeaderName(cfg.auth_header_name ?? '');
          applyRuleConfigMeta(cfg);
        }
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, applyRuleConfigMeta, isCreate, isOwner, loadCatalog, loadRule, numericId]);

  async function onSave() {
    if (!api || !name.trim() || !eventKey) return;
    setSaving(true);
    setError(null);
    try {
      const config: ActionRuleWebhookConfig = {
        url: webhookUrl.trim(),
        ...(isCreate && webhookSecret.trim() ? { secret: webhookSecret.trim() } : {}),
        ...(authHeaderName.trim()
          ? {
              auth_header_name: authHeaderName.trim(),
              auth_header_value: authHeaderValue.trim(),
            }
          : {}),
      };

      if (isCreate) {
        const created = await api.createRule({
          name: name.trim(),
          event: eventKey,
          enabled,
          config,
        });
        navigate(`/webhooks/${created.rule.id}`, {
          replace: true,
          state: created.revealedSecret ? { revealedSecret: created.revealedSecret } : null,
        });
      } else if (numericId != null) {
        const updated = await api.updateRule(numericId, {
          name: name.trim(),
          event: eventKey,
          enabled,
          config,
        });
        applyRuleConfigMeta(updated.config);
      }
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  async function onRotateSecret() {
    if (!api || numericId == null) return;
    const confirmed =
      typeof window === 'undefined' || window.parent === window
        ? window.confirm(
            `${t('webhooksRotateConfirmTitle')}\n\n${t('webhooksRotateConfirmDescription')}`,
          )
        : await new Promise<boolean>((resolve) => {
            shellui.dialog({
              title: t('webhooksRotateConfirmTitle'),
              description: t('webhooksRotateConfirmDescription'),
              mode: 'confirm',
              okLabel: t('webhooksRotateConfirmAction'),
              cancelLabel: t('actionsCancel'),
              onOk: () => resolve(true),
              onCancel: () => resolve(false),
            });
          });
    if (!confirmed) return;

    setRotateLoading(true);
    setError(null);
    try {
      const result = await api.rotateRuleSecret(numericId);
      applyRuleConfigMeta(result.rule.config);
      if (result.revealedSecret) {
        setRevealedSecret(result.revealedSecret);
      }
    } catch (e) {
      setError(e);
    } finally {
      setRotateLoading(false);
    }
  }

  async function onSendTest() {
    if (!api || numericId == null || !enabled) return;
    setSendTestLoading(true);
    setSendTestFeedback(null);
    try {
      const result = await api.sendRuleTest(numericId);
      setSendTestFeedback({
        type: 'success',
        message: t('actionsSendTestSuccess', { webhook_id: result.webhook_id }),
      });
    } catch (e) {
      setSendTestFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : t('actionsSendTestError'),
      });
    } finally {
      setSendTestLoading(false);
    }
  }

  const secretHintLabel = useMemo(() => {
    if (storedSecretHint) {
      return t('webhooksSecretHintEnding', { hint: storedSecretHint });
    }
    if (hasStoredSecret) {
      return t('webhooksSecretHintStored');
    }
    return t('webhooksSecretHintNone');
  }, [hasStoredSecret, storedSecretHint, t]);

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {isCreate ? t('actionsRuleCreateTitle') : t('actionsRuleEditTitle')}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            {t('actionsBadge')}
          </Badge>
        </div>
        <Text className="max-w-3xl text-sm text-muted-foreground">
          {t('actionsRuleEditorDescription')}
        </Text>
      </header>

      <ActionsSubNav />

      {!accessToken && (
        <Text className="font-mono text-sm text-muted-foreground">{t('dashboardNoSession')}</Text>
      )}
      {accessToken && !isOwner && (
        <Text className="font-mono text-sm text-muted-foreground">{t('actionsPageForbidden')}</Text>
      )}

      {error && isApiUnavailableError(error) ? (
        <ApiUnavailableNotice
          error={error}
          t={t}
        />
      ) : null}
      {error && !isApiUnavailableError(error) ? (
        <Text className="font-mono text-sm text-destructive">
          {error instanceof Error ? error.message : t('actionsSaveError')}
        </Text>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2
            className="size-5 animate-spin"
            aria-hidden
          />
          <span className="text-sm">{t('actionsLoading')}</span>
        </div>
      ) : null}

      {accessToken && isOwner && api && !loading ? (
        <div className="space-y-6">
          {revealedSecret ? (
            <WebhookSecretOnceCallout
              secret={revealedSecret}
              onDismiss={() => setRevealedSecret(null)}
            />
          ) : null}

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-lg">{t('actionsRuleBasicsTitle')}</CardTitle>
              <CardDescription className="font-mono text-xs">
                {t('actionsRuleBasicsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t('actionsColName')}
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t('actionsColEvent')}
                </label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 font-mono text-sm"
                  value={eventKey}
                  onChange={(e) => setEventKey(e.target.value)}
                >
                  {events.map((ev) => (
                    <option
                      key={ev.key}
                      value={ev.key}
                    >
                      {ev.label || ev.key}
                    </option>
                  ))}
                </select>
                {selectedEvent?.description ? (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {selectedEvent.description}
                  </p>
                ) : null}
              </div>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <span className="font-mono text-xs">{t('actionsRuleEnabledLabel')}</span>
              </label>
            </CardContent>
          </Card>

          {sampleEnvelopeText ? (
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  {t('actionsSampleEnvelopeTitle')}
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  {t('actionsSampleEnvelopeDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
                  {sampleEnvelopeText}
                </pre>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-lg">
                {t('actionsWebhookConfigTitle')}
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                {t('actionsWebhookConfigDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  URL
                </label>
                <Input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="https://hooks.example.com/shellui"
                />
              </div>
              {isCreate ? (
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {t('actionsWebhookSecret')}
                  </label>
                  <Input
                    type="password"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="font-mono text-sm"
                    placeholder="whsec_…"
                    autoComplete="new-password"
                  />
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {t('webhooksSecretGenerateHelp')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 sm:col-span-2">
                  <div className="space-y-1">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      {t('actionsWebhookSecret')}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{secretHintLabel}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={rotateLoading || saving}
                    onClick={() => void onRotateSecret()}
                  >
                    {rotateLoading ? t('webhooksRotateLoading') : t('webhooksRotateSecret')}
                  </Button>
                </div>
              )}
              <div className="space-y-1">
                <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t('actionsWebhookAuthHeaderName')}
                </label>
                <Input
                  value={authHeaderName}
                  onChange={(e) => setAuthHeaderName(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="Authorization"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t('actionsWebhookAuthHeaderValue')}
                </label>
                <Input
                  type="password"
                  value={authHeaderValue}
                  onChange={(e) => setAuthHeaderValue(e.target.value)}
                  className="font-mono text-sm"
                  autoComplete="new-password"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={saving || !name.trim() || !webhookUrl.trim()}
              onClick={() => void onSave()}
            >
              {saving ? t('actionsSaving') : t('actionsSave')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              asChild
            >
              <Link to="/webhooks">{t('actionsCancel')}</Link>
            </Button>
            {!isCreate && numericId != null ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={sendTestLoading || saving || !enabled}
                title={!enabled ? t('actionsSendTestDisabledRule') : undefined}
                onClick={() => void onSendTest()}
              >
                {sendTestLoading ? t('actionsSendTestLoading') : t('actionsSendTestEvent')}
              </Button>
            ) : null}
          </div>

          {sendTestFeedback ? (
            <div className="space-y-2 font-mono text-xs">
              <Text
                className={
                  sendTestFeedback.type === 'success'
                    ? 'text-emerald-800 dark:text-emerald-200'
                    : 'text-destructive'
                }
              >
                {sendTestFeedback.message}
              </Text>
              {sendTestFeedback.type === 'success' ? (
                <Link
                  to={deliveryLogHref}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {t('actionsViewDeliveryLogs')}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
