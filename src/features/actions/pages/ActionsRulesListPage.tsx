import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  feedbackFromThrown,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { ServiceEmailRulesSection } from '@/features/email/components/ServiceEmailRulesSection';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useWebhookPageMeta } from '@/features/actions/useWebhookPageMeta';
import type { ActionRule, ActionRuleId } from '@/features/actions/types';
import { confirmAction } from '@/lib/confirmAction';
import { SHELLUI_N8N_WEBHOOK_DOCS_URL } from '@/lib/webhookDocsUrls';
import { webhookRuleEditPath, webhookRulesNewPath } from '@/lib/webhookRoutePaths';

export function ActionsRulesListPage() {
  const { t, i18n } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const { service, serviceConfigured } = useWebhookPageMeta();
  const { api } = useActionsApi(accessToken, service.key);
  const { api: emailApi, canManage: canManageEmail } = useEmailApi(accessToken);
  const [rows, setRows] = useState<ActionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<ActionRuleId | null>(null);
  const [rowFeedback, setRowFeedback] = useState<Record<string, ActionFeedbackState>>({});
  const [removedRows, setRemovedRows] = useState<ActionRule[]>([]);

  const load = useCallback(async () => {
    if (!api || !isOwner) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await api.fetchRules());
    } catch (e) {
      setRows([]);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [api, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(i18n.language || 'en', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  };

  function rowKey(id: ActionRuleId): string {
    return String(id);
  }

  function clearRowFeedback(id: ActionRuleId) {
    const key = rowKey(id);
    setRowFeedback((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function refreshRows() {
    if (!api) return;
    setRows(await api.fetchRules());
  }

  async function onToggle(rule: ActionRule) {
    if (!api) return;
    setBusyId(rule.id);
    clearRowFeedback(rule.id);
    try {
      await api.updateRule(rule.id, { enabled: !rule.enabled });
      setRowFeedback((prev) => ({
        ...prev,
        [rowKey(rule.id)]: {
          tone: 'success',
          text: t(rule.enabled ? 'actionsRuleDisabled' : 'actionsRuleEnabled'),
        },
      }));
      try {
        await refreshRows();
      } catch (reloadError) {
        setError(reloadError);
      }
    } catch (e) {
      setRowFeedback((prev) => ({
        ...prev,
        [rowKey(rule.id)]: feedbackFromThrown(e, t('actionsSaveError')),
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(rule: ActionRule) {
    if (!api) return;
    const confirmed = await confirmAction({
      title: t('actionsRuleDeleteTitle'),
      description: t('actionsRuleDeleteConfirm', { name: rule.name }),
      okLabel: t('actionsDelete'),
      cancelLabel: t('actionsCancel'),
      danger: true,
    });
    if (!confirmed) return;
    setBusyId(rule.id);
    clearRowFeedback(rule.id);
    try {
      await api.deleteRule(rule.id);
      setRemovedRows((prev) => [...prev.filter((row) => row.id !== rule.id), rule]);
      try {
        await refreshRows();
      } catch (reloadError) {
        setError(reloadError);
      }
    } catch (e) {
      setRowFeedback((prev) => ({
        ...prev,
        [rowKey(rule.id)]: feedbackFromThrown(e, t('actionsSaveError')),
      }));
    } finally {
      setBusyId(null);
    }
  }

  const removedIds = new Set(removedRows.map((rule) => rowKey(rule.id)));
  const visibleRows = rows.filter((rule) => !removedIds.has(rowKey(rule.id)));

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

      <ServiceEmailRulesSection
        service={service.key}
        client={emailApi}
        canManage={canManageEmail}
        signedIn={Boolean(accessToken)}
      />

      {!serviceConfigured ? <WebhookServiceUnavailable serviceKey={service.key} /> : null}

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
          {error instanceof Error ? error.message : t('actionsLoadError')}
        </Text>
      ) : null}

      {serviceConfigured && accessToken && isOwner && api ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs text-muted-foreground">{t('actionsRulesListHint')}</p>
          {isApiUnavailableError(error) ? (
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
          )}
        </div>
      ) : null}

      {serviceConfigured && accessToken && isOwner && api && loading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2
            className="size-5 animate-spin"
            aria-hidden
          />
          <span className="text-sm">{t('actionsLoading')}</span>
        </div>
      ) : null}

      {serviceConfigured &&
      !loading &&
      visibleRows.length === 0 &&
      removedRows.length === 0 &&
      accessToken &&
      isOwner &&
      api &&
      !isApiUnavailableError(error) ? (
        <Text className="py-8 text-center font-mono text-sm text-muted-foreground">
          {t('actionsRulesEmpty')}
        </Text>
      ) : null}

      {visibleRows.length > 0 || removedRows.length > 0 ? (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs uppercase">{t('actionsColName')}</TableHead>
                <TableHead className="text-xs uppercase">{t('actionsColEvent')}</TableHead>
                <TableHead className="text-xs uppercase">{t('actionsColEnabled')}</TableHead>
                <TableHead className="text-xs uppercase">{t('actionsColUpdated')}</TableHead>
                <TableHead className="text-right text-xs uppercase">
                  {t('usersColActions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono text-xs">
              {visibleRows.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Link
                      to={webhookRuleEditPath(service.key, rule.id)}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {rule.name}
                    </Link>
                  </TableCell>
                  <TableCell>{rule.event}</TableCell>
                  <TableCell>
                    <Badge variant={rule.enabled ? 'default' : 'outline'}>
                      {rule.enabled ? t('actionsEnabledYes') : t('actionsEnabledNo')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(rule.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === rule.id}
                          onClick={() => void onToggle(rule)}
                        >
                          {rule.enabled ? t('actionsDisable') : t('actionsEnable')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          asChild
                        >
                          <Link to={webhookRuleEditPath(service.key, rule.id)}>
                            {t('actionsEdit')}
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={busyId === rule.id}
                          onClick={() => void onDelete(rule)}
                        >
                          {t('actionsDelete')}
                        </Button>
                      </div>
                      <ActionFeedback feedback={rowFeedback[rowKey(rule.id)] ?? null} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {removedRows.map((rule) => (
                <TableRow key={`removed-${rowKey(rule.id)}`}>
                  <TableCell>{rule.name}</TableCell>
                  <TableCell>{rule.event}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right">
                    <ActionFeedback feedback={{ tone: 'success', text: t('actionsRuleDeleted') }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
