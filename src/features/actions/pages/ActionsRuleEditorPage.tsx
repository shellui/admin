import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import shellui from '@shellui/sdk';
import { RotateCw, ScrollText, Send } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/admin/PageHeader';
import { SettingsSection, SettingRow } from '@/components/admin/SettingsSection';
import { CodeBlock } from '@/components/admin/Extras';
import { SHELLUI_N8N_WEBHOOK_DOCS_URL } from '@/lib/webhookDocsUrls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { confirmAction } from '@/lib/confirmAction';
import { getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { WebhookSecretOnceCallout } from '@/features/actions/components/WebhookSecretOnceCallout';
import {
  ApiUnavailableNotice,
  isApiUnavailableError,
} from '@/features/actions/components/ApiUnavailableNotice';
import { useActionsApi } from '@/features/actions/useActionsApi';
import { useEmailApi } from '@/features/email/useEmailApi';
import type { Newsletter } from '@/lib/emailNewsletters';
import { WebhookServiceUnavailable } from '@/features/actions/components/WebhookServiceUnavailable';
import {
  ActionFeedback,
  feedbackFromThrown,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { useWebhookPageMeta } from '@/features/actions/useWebhookPageMeta';
import type { ActionEventCatalogEntry, ActionRuleWebhookConfig } from '@/features/actions/types';
import {
  isWebhookCreatePath,
  parseWebhookRuleIdFromPathname,
  webhookDeliveriesPath,
  webhookRuleEditPath,
  webhookRulesListPath,
} from '@/lib/webhookRoutePaths';

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
  const navigate = useNavigate();
  const location = useLocation();
  const isCreate = isWebhookCreatePath(location.pathname);
  const ruleIdParam = parseWebhookRuleIdFromPathname(location.pathname);
  const numericId = !isCreate && ruleIdParam ? Number.parseInt(ruleIdParam, 10) : null;
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const { service, serviceConfigured } = useWebhookPageMeta();
  const { api } = useActionsApi(accessToken, service.key);

  const [events, setEvents] = useState<ActionEventCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotateLoading, setRotateLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saveFeedback, setSaveFeedback] = useState<ActionFeedbackState | null>(null);
  const [rotateFeedback, setRotateFeedback] = useState<ActionFeedbackState | null>(null);
  const [sendTestLoading, setSendTestLoading] = useState(false);
  const [sendTestFeedback, setSendTestFeedback] = useState<ActionFeedbackState | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [storedSecretHint, setStoredSecretHint] = useState<string | null>(null);
  const [hasStoredSecret, setHasStoredSecret] = useState(false);

  const [name, setName] = useState('');
  const [eventKey, setEventKey] = useState('');
  const [newsletterId, setNewsletterId] = useState<number | null>(null);
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const isEmailService = service.key === 'email';
  const { api: emailApi } = useEmailApi(isEmailService ? accessToken : null);
  const isNewsletterEvent = isEmailService && eventKey.startsWith('email.newsletter.');

  useEffect(() => {
    if (!isEmailService || !emailApi) return;
    let cancelled = false;
    emailApi
      .fetchNewsletters()
      .then((rows) => {
        if (!cancelled) setNewsletters(rows);
      })
      .catch(() => {
        // The selector stays on "All newsletters" when the list cannot load.
      });
    return () => {
      cancelled = true;
    };
  }, [emailApi, isEmailService]);
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
      ? `${webhookDeliveriesPath(service.key)}?action_rule_id=${encodeURIComponent(String(numericId))}`
      : webhookDeliveriesPath(service.key);

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
          setNewsletterId(typeof cfg.newsletter_id === 'number' ? cfg.newsletter_id : null);
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

  function clearActionFeedback() {
    setSaveFeedback(null);
    setRotateFeedback(null);
    setSendTestFeedback(null);
  }

  async function onSave() {
    if (!api || !name.trim() || !eventKey) return;
    setSaving(true);
    setSaveFeedback(null);
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
        ...(isEmailService ? { newsletter_id: isNewsletterEvent ? newsletterId : null } : {}),
      };

      if (isCreate) {
        const created = await api.createRule({
          name: name.trim(),
          event: eventKey,
          enabled,
          config,
        });
        navigate(webhookRuleEditPath(service.key, created.rule.id), {
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
        setSaveFeedback({ tone: 'success', text: t('actionsRuleSaved') });
      }
    } catch (e) {
      setSaveFeedback(feedbackFromThrown(e, t('actionsSaveError')));
    } finally {
      setSaving(false);
    }
  }

  async function onRotateSecret() {
    if (!api || numericId == null) return;
    const confirmed = await confirmAction({
      title: t('webhooksRotateConfirmTitle'),
      description: t('webhooksRotateConfirmDescription'),
      okLabel: t('webhooksRotateConfirmAction'),
      cancelLabel: t('actionsCancel'),
      danger: true,
    });
    if (!confirmed) return;

    setRotateLoading(true);
    setRotateFeedback(null);
    try {
      const result = await api.rotateRuleSecret(numericId);
      applyRuleConfigMeta(result.rule.config);
      if (result.revealedSecret) {
        setRevealedSecret(result.revealedSecret);
      }
      setRotateFeedback({ tone: 'success', text: t('webhooksSecretRotated') });
    } catch (e) {
      setRotateFeedback(feedbackFromThrown(e, t('actionsSaveError')));
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
      const text = result.queued
        ? t('actionsSendTestQueued')
        : t('actionsSendTestSuccess', { webhook_id: result.webhook_id });
      setSendTestFeedback({ tone: 'success', text });
      shellui.toast({ title: text, type: 'success' });
    } catch (e) {
      setSendTestFeedback(feedbackFromThrown(e, t('actionsSendTestError')));
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

  const ready = serviceConfigured && accessToken && isOwner && api && !loading && !error;
  const field = 'space-y-1.5';
  const help = 'text-xs text-muted-foreground';

  return (
    <div className="w-full space-y-6">
      <PageHeader
        back={{ to: webhookRulesListPath(service.key), label: t('actionsNavRules') }}
        title={isCreate ? t('actionsRuleCreate') : name.trim() || t(service.pageTitleKey)}
        service={t(service.badgeKey)}
        description={t('ruleEditorTypeLine')}
        actions={
          ready && !isCreate && numericId != null ? (
            <>
              <Button
                type="button"
                variant="outline"
                asChild
              >
                <Link to={deliveryLogHref}>
                  <ScrollText aria-hidden />
                  {t('actionsNavDeliveries')}
                </Link>
              </Button>
              <div className="flex flex-col items-end gap-1">
                <Button
                  type="button"
                  variant="outline"
                  disabled={sendTestLoading || saving || !enabled}
                  title={!enabled ? t('actionsSendTestDisabledRule') : undefined}
                  onClick={() => void onSendTest()}
                >
                  <Send aria-hidden />
                  {sendTestLoading ? t('actionsSendTestLoading') : t('actionsSendTestEvent')}
                </Button>
                <ActionFeedback feedback={sendTestFeedback} />
              </div>
            </>
          ) : undefined
        }
      />

      {!serviceConfigured ? <WebhookServiceUnavailable serviceKey={service.key} /> : null}

      {!accessToken ? (
        <Alert variant="info">
          <AlertDescription>{t('dashboardNoSession')}</AlertDescription>
        </Alert>
      ) : null}
      {accessToken && !isOwner ? (
        <Alert variant="info">
          <AlertDescription>{t('actionsPageForbidden')}</AlertDescription>
        </Alert>
      ) : null}

      {error && isApiUnavailableError(error) ? (
        <ApiUnavailableNotice
          error={error}
          t={t}
        />
      ) : null}
      {error && !isApiUnavailableError(error) ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof Error ? error.message : t('actionsLoadError')}
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div
          className="space-y-4 motion-safe:animate-pulse"
          aria-busy
        >
          <span className="sr-only">{t('actionsLoading')}</span>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)] md:gap-8"
              aria-hidden
            >
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="space-y-3 rounded-xl border border-border bg-card p-5">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {ready ? (
        <div className="space-y-8">
          <SettingsSection
            id="rule"
            title={t('ruleEditorSecRule')}
            description={t('ruleEditorSecRuleHint')}
          >
            <div className={field}>
              <Label htmlFor="webhook-rule-name">{t('actionsColName')}</Label>
              <Input
                id="webhook-rule-name"
                value={name}
                onChange={(e) => {
                  clearActionFeedback();
                  setName(e.target.value);
                }}
              />
            </div>
            <div className={field}>
              <Label htmlFor="webhook-rule-event">{t('actionsColEvent')}</Label>
              <select
                id="webhook-rule-event"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                value={eventKey}
                onChange={(e) => {
                  clearActionFeedback();
                  setEventKey(e.target.value);
                }}
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
              <p className={help}>
                {selectedEvent?.description ||
                  t('actionsRuleBasicsDescription', { scope: t(service.eventScopeKey) })}
              </p>
            </div>
            {isNewsletterEvent ? (
              <div className={field}>
                <Label htmlFor="webhook-newsletter-filter">{t('webhooksNewsletterFilter')}</Label>
                <select
                  id="webhook-newsletter-filter"
                  className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  value={newsletterId == null ? '' : String(newsletterId)}
                  onChange={(e) => {
                    clearActionFeedback();
                    setNewsletterId(e.target.value ? Number(e.target.value) : null);
                  }}
                >
                  <option value="">{t('webhooksNewsletterFilterAll')}</option>
                  {newsletterId != null && !newsletters.some((n) => n.id === newsletterId) ? (
                    <option value={String(newsletterId)}>#{newsletterId}</option>
                  ) : null}
                  {newsletters.map((n) => (
                    <option
                      key={n.id}
                      value={String(n.id)}
                    >
                      {n.name}
                    </option>
                  ))}
                </select>
                <p className={help}>{t('webhooksNewsletterFilterHint')}</p>
              </div>
            ) : null}
            <SettingRow
              titleId="webhook-rule-enabled-label"
              title={t('actionsRuleEnabledLabel')}
              description={t('ruleEditorEnabledHint')}
              control={
                <Switch
                  checked={enabled}
                  aria-labelledby="webhook-rule-enabled-label"
                  onCheckedChange={(next) => {
                    clearActionFeedback();
                    setEnabled(next);
                  }}
                />
              }
            />
          </SettingsSection>

          {sampleEnvelopeText ? (
            <SettingsSection
              id="sample"
              title={t('ruleEditorSecSample')}
              description={t('ruleEditorSecSampleHint', { event: eventKey })}
            >
              <CodeBlock>{sampleEnvelopeText}</CodeBlock>
            </SettingsSection>
          ) : null}

          <SettingsSection
            id="delivery"
            title={t('ruleEditorSecDelivery')}
            description={t('ruleEditorSecDeliveryHint')}
            docs={{ href: SHELLUI_N8N_WEBHOOK_DOCS_URL, label: t('webhooksN8nDocLink') }}
            footerAction={
              <>
                <Button
                  type="button"
                  variant="outline"
                  asChild
                >
                  <Link to={webhookRulesListPath(service.key)}>{t('actionsCancel')}</Link>
                </Button>
                <div className="flex items-center gap-3">
                  <ActionFeedback feedback={saveFeedback} />
                  <Button
                    type="button"
                    disabled={saving || !name.trim() || !webhookUrl.trim()}
                    onClick={() => void onSave()}
                  >
                    {saving ? t('actionsSaving') : t('actionsSave')}
                  </Button>
                </div>
              </>
            }
          >
            {revealedSecret ? (
              <WebhookSecretOnceCallout
                secret={revealedSecret}
                onDismiss={() => setRevealedSecret(null)}
              />
            ) : null}
            <div className={field}>
              <Label htmlFor="webhook-rule-url">URL</Label>
              <Input
                id="webhook-rule-url"
                value={webhookUrl}
                onChange={(e) => {
                  clearActionFeedback();
                  setWebhookUrl(e.target.value);
                }}
                className="font-mono"
                placeholder="https://hooks.example.com/shellui"
                inputMode="url"
              />
              <p className={help}>
                {t('actionsWebhookConfigDescription', { service: t(service.labelKey) })}
              </p>
            </div>
            {isCreate ? (
              <div className={field}>
                <Label htmlFor="webhook-rule-secret">{t('actionsWebhookSecret')}</Label>
                <Input
                  id="webhook-rule-secret"
                  type="password"
                  data-1p-ignore
                  data-lpignore="true"
                  value={webhookSecret}
                  onChange={(e) => {
                    clearActionFeedback();
                    setWebhookSecret(e.target.value);
                  }}
                  className="font-mono"
                  placeholder="whsec_..."
                  autoComplete="new-password"
                />
                <p className={help}>{t('webhooksSecretGenerateHelp')}</p>
              </div>
            ) : (
              <div className={field}>
                <p className="text-sm font-medium">{t('actionsWebhookSecret')}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-mono text-xs text-muted-foreground">{secretHintLabel}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={rotateLoading || saving}
                    onClick={() => void onRotateSecret()}
                  >
                    <RotateCw aria-hidden />
                    {rotateLoading ? t('webhooksRotateLoading') : t('webhooksRotateSecret')}
                  </Button>
                </div>
                <ActionFeedback feedback={rotateFeedback} />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={field}>
                <Label htmlFor="webhook-rule-auth-name">{t('actionsWebhookAuthHeaderName')}</Label>
                <Input
                  id="webhook-rule-auth-name"
                  value={authHeaderName}
                  onChange={(e) => {
                    clearActionFeedback();
                    setAuthHeaderName(e.target.value);
                  }}
                  className="font-mono"
                  placeholder="Authorization"
                />
              </div>
              <div className={field}>
                <Label htmlFor="webhook-rule-auth-value">
                  {t('actionsWebhookAuthHeaderValue')}
                </Label>
                <Input
                  id="webhook-rule-auth-value"
                  type="password"
                  data-1p-ignore
                  data-lpignore="true"
                  value={authHeaderValue}
                  onChange={(e) => {
                    clearActionFeedback();
                    setAuthHeaderValue(e.target.value);
                  }}
                  className="font-mono"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </SettingsSection>
        </div>
      ) : null}
    </div>
  );
}
