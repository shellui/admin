import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { ActionsSubNav } from '@/features/actions/components/ActionsSubNav';
import {
  ApiUnavailableNotice,
  isApiUnavailableError,
} from '@/features/actions/components/ApiUnavailableNotice';
import { useActionsApi } from '@/features/actions/useActionsApi';
import { WebhookServiceUnavailable } from '@/features/actions/components/WebhookServiceUnavailable';
import {
  ActionFeedback,
  feedbackFromError,
  feedbackFromThrown,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { SearchField } from '@/features/email/components/SearchField';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useWebhookPageMeta } from '@/features/actions/useWebhookPageMeta';
import type { ActionRule } from '@/features/actions/types';
import { confirmAction } from '@/lib/confirmAction';
import { emailErrorText } from '@/lib/emailApiErrors';
import { filterByQuery, listNeedsSearch, sectionTitle } from '@/lib/emailList';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import { mergeServiceRules, type MergedServiceRule } from '@/lib/serviceRules';
import type { EmailRule, EmailTemplateRow } from '@/lib/emailTypes';
import { SHELLUI_N8N_WEBHOOK_DOCS_URL } from '@/lib/webhookDocsUrls';
import {
  emailRuleEditPath,
  emailRuleNewPath,
  webhookRuleEditPath,
  webhookRulesNewPath,
} from '@/lib/webhookRoutePaths';
import { cn } from '@/lib/utils';

function EnabledSwitch({
  checked,
  disabled,
  label,
  onClick,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'bg-primary' : 'bg-input',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

export function ActionsRulesListPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const { service, serviceConfigured } = useWebhookPageMeta();
  const { api } = useActionsApi(accessToken, service.key);
  const { api: emailApi, canManage: canManageEmail } = useEmailApi(accessToken);
  const [webhooks, setWebhooks] = useState<ActionRule[]>([]);
  const [emails, setEmails] = useState<EmailRule[]>([]);
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [webhookError, setWebhookError] = useState<unknown>(null);
  const [emailError, setEmailError] = useState<unknown>(null);
  const [query, setQuery] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rowFeedback, setRowFeedback] = useState<Record<string, ActionFeedbackState>>({});
  const [removed, setRemoved] = useState<MergedServiceRule[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const jobs: Promise<void>[] = [];
    if (api && isOwner && serviceConfigured) {
      jobs.push(
        api
          .fetchRules()
          .then((rows) => {
            setWebhooks(rows);
            setWebhookError(null);
          })
          .catch((error) => {
            setWebhooks([]);
            setWebhookError(error);
          }),
      );
    } else {
      setWebhooks([]);
      setWebhookError(null);
    }
    if (emailApi && canManageEmail) {
      jobs.push(
        Promise.all([emailApi.fetchRules(service.key), emailApi.fetchTemplates()])
          .then(([rules, rows]) => {
            setEmails(rules);
            setTemplates(rows);
            setEmailError(null);
          })
          .catch((error) => {
            setEmails([]);
            setTemplates([]);
            setEmailError(error);
          }),
      );
    } else {
      setEmails([]);
      setTemplates([]);
      setEmailError(null);
    }
    await Promise.all(jobs);
    setLoading(false);
  }, [api, canManageEmail, emailApi, isOwner, service.key, serviceConfigured]);

  useEffect(() => {
    void load();
  }, [load]);

  const templateName = useCallback(
    (templateId: number) => templates.find((row) => row.id === templateId)?.name ?? '',
    [templates],
  );

  const merged = useMemo(() => {
    const removedKeys = new Set(removed.map((row) => row.key));
    return mergeServiceRules({
      webhooks,
      emails,
      templateName,
      hintsLabel: t('emailRuleRecipientHints'),
    }).filter((row) => !removedKeys.has(row.key));
  }, [emails, removed, t, templateName, webhooks]);

  const visible = filterByQuery(
    merged,
    query,
    (row) => `${row.kind} ${row.event} ${row.target} ${row.name}`,
  );

  function clearRowFeedback(key: string) {
    setRowFeedback((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function refreshWebhooks() {
    if (!api) return;
    setWebhooks(await api.fetchRules());
  }

  async function refreshEmails() {
    if (!emailApi) return;
    const [rules, rows] = await Promise.all([
      emailApi.fetchRules(service.key),
      emailApi.fetchTemplates(),
    ]);
    setEmails(rules);
    setTemplates(rows);
  }

  async function onToggle(row: MergedServiceRule) {
    if (row.builtIn) return;
    setBusyKey(row.key);
    clearRowFeedback(row.key);
    try {
      if (row.kind === 'webhook') {
        if (!api) return;
        await api.updateRule(row.id, { enabled: !row.enabled });
        setRowFeedback((prev) => ({
          ...prev,
          [row.key]: {
            tone: 'success',
            text: t(row.enabled ? 'actionsRuleDisabled' : 'actionsRuleEnabled'),
          },
        }));
        try {
          await refreshWebhooks();
        } catch (reloadError) {
          setWebhookError(reloadError);
        }
      } else {
        if (!emailApi) return;
        await emailApi.patchRule(Number(row.id), { enabled: !row.enabled });
        setRowFeedback((prev) => ({
          ...prev,
          [row.key]: {
            tone: 'success',
            text: t(row.enabled ? 'emailRuleDisabled' : 'emailRuleEnabled'),
          },
        }));
        try {
          await refreshEmails();
        } catch (reloadError) {
          setEmailError(reloadError);
        }
      }
    } catch (error) {
      setRowFeedback((prev) => ({
        ...prev,
        [row.key]:
          row.kind === 'webhook'
            ? feedbackFromThrown(error, t('actionsSaveError'))
            : feedbackFromError(t, error),
      }));
    } finally {
      setBusyKey(null);
    }
  }

  async function onDelete(row: MergedServiceRule) {
    if (row.builtIn) return;
    if (row.kind === 'webhook') {
      if (!api) return;
      const confirmed = await confirmAction({
        title: t('actionsRuleDeleteTitle'),
        description: t('actionsRuleDeleteConfirm', { name: row.name }),
        okLabel: t('actionsDelete'),
        cancelLabel: t('actionsCancel'),
        danger: true,
      });
      if (!confirmed) return;
    } else {
      if (!emailApi) return;
      const confirmed = await askShelluiConfirm({
        title: t('emailRuleDeleteTitle'),
        description: t('emailRuleDeleteDescription'),
        okLabel: t('actionsDelete'),
        cancelLabel: t('actionsCancel'),
        mode: 'delete',
      });
      if (!confirmed) return;
    }
    setBusyKey(row.key);
    clearRowFeedback(row.key);
    try {
      if (row.kind === 'webhook') {
        await api?.deleteRule(row.id);
      } else {
        await emailApi?.deleteRule(Number(row.id));
      }
      setRemoved((prev) => [...prev.filter((item) => item.key !== row.key), row]);
      try {
        if (row.kind === 'webhook') await refreshWebhooks();
        else await refreshEmails();
      } catch (reloadError) {
        if (row.kind === 'webhook') setWebhookError(reloadError);
        else setEmailError(reloadError);
      }
    } catch (error) {
      setRowFeedback((prev) => ({
        ...prev,
        [row.key]:
          row.kind === 'webhook'
            ? feedbackFromThrown(error, t('actionsSaveError'))
            : feedbackFromError(t, error),
      }));
    } finally {
      setBusyKey(null);
    }
  }

  const canCreateWebhook = Boolean(serviceConfigured && accessToken && isOwner && api);
  const canCreateEmail = Boolean(accessToken && canManageEmail && emailApi);
  const showList = visible.length > 0 || removed.length > 0;
  const showEmpty =
    !loading &&
    visible.length === 0 &&
    removed.length === 0 &&
    !webhookError &&
    !emailError &&
    (canCreateWebhook || canCreateEmail);

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t(service.pageTitleKey)}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            {t(service.badgeKey)}
          </Badge>
        </div>
        <Text className="max-w-3xl text-sm text-muted-foreground">{t(service.descriptionKey)}</Text>
        <a
          href={SHELLUI_N8N_WEBHOOK_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-primary underline-offset-2 hover:underline"
        >
          {t('webhooksN8nDocLink')}
          <ExternalLink
            className="size-3"
            aria-hidden
          />
        </a>
      </header>

      <ActionsSubNav />

      {!serviceConfigured ? <WebhookServiceUnavailable serviceKey={service.key} /> : null}

      {!accessToken ? (
        <Text className="font-mono text-sm text-muted-foreground">{t('dashboardNoSession')}</Text>
      ) : null}
      {accessToken && !isOwner && !canManageEmail ? (
        <Text className="font-mono text-sm text-muted-foreground">{t('actionsPageForbidden')}</Text>
      ) : null}

      {webhookError && isApiUnavailableError(webhookError) ? (
        <ApiUnavailableNotice
          error={webhookError}
          t={t}
        />
      ) : null}
      {webhookError && !isApiUnavailableError(webhookError) ? (
        <Text className="font-mono text-sm text-destructive">
          {webhookError instanceof Error ? webhookError.message : t('actionsLoadError')}
        </Text>
      ) : null}
      {emailError ? (
        <Text className="font-mono text-sm text-destructive">{emailErrorText(t, emailError)}</Text>
      ) : null}

      {canCreateWebhook || canCreateEmail ? (
        <div className="flex flex-wrap items-center gap-2">
          {canCreateWebhook ? (
            isApiUnavailableError(webhookError) ? (
              <Button
                type="button"
                size="sm"
                disabled
              >
                {t('actionsRuleCreate')}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                asChild
              >
                <Link to={webhookRulesNewPath(service.key)}>{t('actionsRuleCreate')}</Link>
              </Button>
            )
          ) : null}
          {canCreateEmail ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              asChild
            >
              <Link to={emailRuleNewPath(service.key)}>{t('emailRuleCreate')}</Link>
            </Button>
          ) : null}
        </div>
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

      {!loading && (canCreateWebhook || canCreateEmail) && listNeedsSearch(merged.length) ? (
        <SearchField
          value={query}
          onChange={setQuery}
          label={t('emailServiceRulesSearch')}
          placeholder={t('emailServiceRulesSearch')}
        />
      ) : null}

      {!loading && (showList || showEmpty) ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {sectionTitle(t('emailServiceRulesTitle'), visible.length)}
          </h2>
          {showEmpty ? (
            <Text className="py-8 text-center font-mono text-sm text-muted-foreground">
              {t('emailServiceRulesEmpty')}
            </Text>
          ) : (
            <ul className="divide-y divide-border/80 rounded-md border border-border/80">
              {visible.map((row) => (
                <li
                  key={row.key}
                  className="flex flex-wrap items-start justify-between gap-3 px-3 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={row.kind === 'email' ? 'secondary' : 'outline'}>
                        {row.kind === 'email' ? t('emailRuleKindEmail') : t('emailRuleKindWebhook')}
                      </Badge>
                      {row.builtIn ? (
                        <Badge
                          variant="muted"
                          title={t('emailRuleBuiltInLocked')}
                        >
                          {t('emailRuleBuiltIn')}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="font-mono text-xs">{row.event}</p>
                    <p className="break-all text-sm text-muted-foreground">{row.target}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {row.builtIn ? null : (
                        <EnabledSwitch
                          checked={row.enabled}
                          disabled={busyKey === row.key}
                          label={row.kind === 'webhook' ? row.name : row.event}
                          onClick={() => void onToggle(row)}
                        />
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        asChild
                      >
                        <Link
                          to={
                            row.kind === 'webhook'
                              ? webhookRuleEditPath(service.key, row.id)
                              : emailRuleEditPath(service.key, row.id)
                          }
                        >
                          {t('actionsEdit')}
                        </Link>
                      </Button>
                      {row.builtIn ? null : (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={busyKey === row.key}
                          onClick={() => void onDelete(row)}
                        >
                          {t('actionsDelete')}
                        </Button>
                      )}
                    </div>
                    <ActionFeedback feedback={rowFeedback[row.key] ?? null} />
                  </div>
                </li>
              ))}
              {removed.map((row) => (
                <li
                  key={`removed-${row.key}`}
                  className="flex justify-end px-3 py-3"
                >
                  <ActionFeedback
                    feedback={{
                      tone: 'success',
                      text: t(row.kind === 'webhook' ? 'actionsRuleDeleted' : 'emailRuleDeleted'),
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
