import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { ActionsSubNav } from '@/features/actions/components/ActionsSubNav';
import {
  ReactEmailActionEditor,
  type ReactEmailActionEditorHandle,
} from '@/features/actions/components/ReactEmailActionEditor';
import { emptyActionEmailTemplate, normalizeEmailTemplate } from '@/lib/actionEmailDefaults';
import {
  ApiUnavailableNotice,
  isApiUnavailableError,
} from '@/features/actions/components/ApiUnavailableNotice';
import { useActionsApi } from '@/features/actions/useActionsApi';
import type {
  ActionEmailTemplate,
  ActionEventCatalogEntry,
  ActionRuleEmailConfig,
  ActionRuleKind,
  ActionRuleWebhookConfig,
} from '@/features/actions/types';

const emptyTemplate = emptyActionEmailTemplate;

function parseRecipients(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ActionsRuleEditorPage() {
  const { t } = useTranslation();
  const { ruleId } = useParams();
  const isCreate = ruleId === 'new' || !ruleId;
  const numericId = !isCreate && ruleId ? Number.parseInt(ruleId, 10) : null;
  const navigate = useNavigate();
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const { api } = useActionsApi(accessToken);

  const [events, setEvents] = useState<ActionEventCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [name, setName] = useState('');
  const [eventKey, setEventKey] = useState('');
  const [kind, setKind] = useState<ActionRuleKind>('email');
  const [enabled, setEnabled] = useState(true);
  const [recipientsText, setRecipientsText] = useState('');
  const [includePayloadEmail, setIncludePayloadEmail] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [authHeaderName, setAuthHeaderName] = useState('');
  const [authHeaderValue, setAuthHeaderValue] = useState('');
  const [templateEn, setTemplateEn] = useState<ActionEmailTemplate>(emptyTemplate());
  const [templateFr, setTemplateFr] = useState<ActionEmailTemplate>(emptyTemplate());
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [resetTemplatesLoading, setResetTemplatesLoading] = useState(false);
  const [templateFetchError, setTemplateFetchError] = useState<string | null>(null);
  const initialEventRef = useRef<string | null>(null);
  const emailEditorRef = useRef<ReactEmailActionEditorHandle | null>(null);
  const [templateContentRevision, setTemplateContentRevision] = useState(0);

  const selectedEvent = useMemo(
    () => events.find((e) => e.key === eventKey) ?? null,
    [events, eventKey],
  );

  const loadCatalog = useCallback(async () => {
    if (!api || !isOwner) return [];
    return api.fetchEvents();
  }, [api, isOwner]);

  const loadRule = useCallback(async () => {
    if (!api || !isOwner || numericId == null || !Number.isFinite(numericId)) return null;
    return api.fetchRule(numericId);
  }, [api, isOwner, numericId]);

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
          initialEventRef.current = rule.event;
          setKind(rule.kind);
          setEnabled(rule.enabled);
          if (rule.kind === 'email') {
            const cfg = rule.config as ActionRuleEmailConfig;
            setRecipientsText((cfg.recipients ?? []).join(', '));
            setIncludePayloadEmail(cfg.include_payload_email === true);
            const templates = cfg.email_templates ?? {};
            setTemplateEn(normalizeEmailTemplate(templates.en, 'en'));
            setTemplateFr(normalizeEmailTemplate(templates.fr, 'fr'));
            try {
              const [defEn, defFr] = await Promise.all([
                api.fetchEmailTemplate(rule.id, 'en'),
                api.fetchEmailTemplate(rule.id, 'fr'),
              ]);
              if (!cancelled) {
                if (!templates.en?.html && !templates.en?.document) {
                  setTemplateEn(normalizeEmailTemplate(defEn, 'en'));
                }
                if (!templates.fr?.html && !templates.fr?.document) {
                  setTemplateFr(normalizeEmailTemplate(defFr, 'fr'));
                }
              }
            } catch {
              /* defaults optional */
            }
          } else {
            const cfg = rule.config as ActionRuleWebhookConfig;
            setWebhookUrl(cfg.url ?? '');
            setAuthHeaderName(cfg.auth_header_name ?? '');
          }
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
  }, [api, isCreate, isOwner, loadCatalog, loadRule, numericId]);

  useEffect(() => {
    if (!api || !isOwner || loading || kind !== 'email' || !eventKey.trim()) return;

    const shouldAutoFill =
      isCreate || initialEventRef.current == null || eventKey !== initialEventRef.current;
    if (!shouldAutoFill) return;

    let cancelled = false;
    setTemplatesLoading(true);
    setTemplateFetchError(null);
    void (async () => {
      try {
        const [defEn, defFr] = await Promise.all([
          api.fetchDefaultEmailTemplate(eventKey, 'en'),
          api.fetchDefaultEmailTemplate(eventKey, 'fr'),
        ]);
        if (cancelled) return;
        setTemplateEn(normalizeEmailTemplate(defEn, 'en'));
        setTemplateFr(normalizeEmailTemplate(defFr, 'fr'));
        setTemplateContentRevision((r) => r + 1);
      } catch (e) {
        if (!cancelled) {
          setTemplateFetchError(
            e instanceof Error ? e.message : t('actionsEmailTemplateLoadError'),
          );
        }
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, eventKey, isCreate, isOwner, kind, loading, t]);

  const resetEmailTemplatesToDefault = useCallback(async () => {
    if (!api || kind !== 'email' || !eventKey.trim()) return;
    if (!window.confirm(t('actionsEmailResetConfirm'))) return;
    setResetTemplatesLoading(true);
    setTemplateFetchError(null);
    try {
      const [defEn, defFr] = await Promise.all([
        api.fetchDefaultEmailTemplate(eventKey, 'en'),
        api.fetchDefaultEmailTemplate(eventKey, 'fr'),
      ]);
      setTemplateEn(normalizeEmailTemplate(defEn, 'en'));
      setTemplateFr(normalizeEmailTemplate(defFr, 'fr'));
      setTemplateContentRevision((r) => r + 1);
    } catch (e) {
      setTemplateFetchError(e instanceof Error ? e.message : t('actionsEmailTemplateLoadError'));
    } finally {
      setResetTemplatesLoading(false);
    }
  }, [api, eventKey, kind, t]);

  async function onSave() {
    if (!api || !name.trim() || !eventKey) return;
    setSaving(true);
    setError(null);
    try {
      let emailTemplates = { en: templateEn, fr: templateFr };
      if (kind === 'email' && emailEditorRef.current) {
        emailTemplates = await emailEditorRef.current.compileAll();
      }
      const config =
        kind === 'email'
          ? ({
              recipients: parseRecipients(recipientsText),
              include_payload_email: includePayloadEmail,
              email_templates: emailTemplates,
            } satisfies ActionRuleEmailConfig)
          : ({
              url: webhookUrl.trim(),
              ...(webhookSecret.trim() ? { secret: webhookSecret.trim() } : {}),
              ...(authHeaderName.trim()
                ? {
                    auth_header_name: authHeaderName.trim(),
                    auth_header_value: authHeaderValue.trim(),
                  }
                : {}),
            } satisfies ActionRuleWebhookConfig);

      if (isCreate) {
        const created = await api.createRule({
          name: name.trim(),
          event: eventKey,
          kind,
          enabled,
          config,
        });
        navigate(`/actions/rules/${created.id}`, { replace: true });
      } else if (numericId != null) {
        await api.updateRule(numericId, {
          name: name.trim(),
          event: eventKey,
          kind,
          enabled,
          config,
        });
      }
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

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
              <div className="space-y-1">
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
              <div className="space-y-1">
                <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t('actionsColKind')}
                </label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 font-mono text-sm"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ActionRuleKind)}
                >
                  <option value="email">{t('actionsKindEmail')}</option>
                  <option value="webhook">{t('actionsKindWebhook')}</option>
                </select>
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

          {kind === 'email' ? (
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  {t('actionsEmailConfigTitle')}
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  {t('actionsEmailConfigDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {t('actionsEmailRecipients')}
                  </label>
                  <Input
                    value={recipientsText}
                    onChange={(e) => setRecipientsText(e.target.value)}
                    className="font-mono text-sm"
                    placeholder="ops@example.com, security@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    className={`flex items-center gap-2 ${!selectedEvent?.payload_email_field ? 'opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={includePayloadEmail}
                      disabled={!selectedEvent?.payload_email_field}
                      onChange={(e) => setIncludePayloadEmail(e.target.checked)}
                    />
                    <span className="font-mono text-xs">{t('actionsEmailIncludePayload')}</span>
                  </label>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {t('actionsEmailIncludePayloadHelp')}
                  </p>
                </div>
                {templatesLoading || resetTemplatesLoading ? (
                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden
                    />
                    {resetTemplatesLoading
                      ? t('actionsEmailResetLoading')
                      : t('actionsEmailTemplateLoading')}
                  </div>
                ) : null}
                {templateFetchError ? (
                  <Text className="font-mono text-xs text-amber-800 dark:text-amber-200">
                    {templateFetchError}
                  </Text>
                ) : null}
                <ReactEmailActionEditor
                  ref={emailEditorRef}
                  templateVariables={selectedEvent?.template_variables}
                  valueEn={templateEn}
                  valueFr={templateFr}
                  onChangeEn={setTemplateEn}
                  onChangeFr={setTemplateFr}
                  contentRevision={templateContentRevision}
                  disabled={templatesLoading || resetTemplatesLoading || saving}
                  showResetToDefault={Boolean(eventKey.trim())}
                  resetLoading={resetTemplatesLoading}
                  onResetToDefault={() => void resetEmailTemplatesToDefault()}
                />
              </CardContent>
            </Card>
          ) : (
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
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {t('actionsWebhookSecret')}
                  </label>
                  <Input
                    type="password"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="font-mono text-sm"
                    placeholder={t('actionsWebhookSecretPlaceholder')}
                    autoComplete="new-password"
                  />
                </div>
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
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={saving || !name.trim()}
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
              <Link to="/actions/rules">{t('actionsCancel')}</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
