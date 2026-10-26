import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import shellui from '@shellui/sdk';
import { ExternalLink, Lock, Mail, MoreHorizontal, Plus, Webhook } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTableCard, SkeletonRows } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
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

export function ActionsRulesListPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const navigate = useNavigate();
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
        shellui.toast({
          title: t(row.enabled ? 'actionsRuleDisabled' : 'actionsRuleEnabled'),
          type: 'success',
        });
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
        shellui.toast({
          title: t(row.enabled ? 'emailRuleDisabled' : 'emailRuleEnabled'),
          type: 'success',
        });
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
      shellui.toast({
        title: t(row.kind === 'webhook' ? 'actionsRuleDeleted' : 'emailRuleDeleted'),
        type: 'success',
      });
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

  const createButtons = (
    <>
      {canCreateWebhook ? (
        isApiUnavailableError(webhookError) ? (
          <Button
            type="button"
            variant="outline"
            disabled
          >
            <Webhook aria-hidden />
            {t('actionsRuleCreate')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            asChild
          >
            <Link to={webhookRulesNewPath(service.key)}>
              <Webhook aria-hidden />
              {t('actionsRuleCreate')}
            </Link>
          </Button>
        )
      ) : null}
      {canCreateEmail ? (
        <Button
          type="button"
          asChild
        >
          <Link to={emailRuleNewPath(service.key)}>
            <Plus aria-hidden />
            {t('emailRuleCreate')}
          </Link>
        </Button>
      ) : null}
    </>
  );

  const editPath = (row: MergedServiceRule) =>
    row.kind === 'webhook'
      ? webhookRuleEditPath(service.key, row.id)
      : emailRuleEditPath(service.key, row.id);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t(service.pageTitleKey)}
        service={t(service.badgeKey)}
        description={t('actionsListDescription', { service: t(service.labelKey) })}
        actions={canCreateWebhook || canCreateEmail ? createButtons : undefined}
      />

      <ActionsSubNav
        rulesCount={loading ? undefined : merged.length}
        aside={
          <a
            href={SHELLUI_N8N_WEBHOOK_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground no-underline hover:text-foreground"
          >
            {t('webhooksN8nDocLink')}
            <ExternalLink
              className="size-3.5"
              aria-hidden
            />
            <span className="sr-only">{t('navOpensExternally')}</span>
          </a>
        }
      />

      {!serviceConfigured ? <WebhookServiceUnavailable serviceKey={service.key} /> : null}

      {!accessToken ? (
        <Alert variant="info">
          <AlertDescription>{t('dashboardNoSession')}</AlertDescription>
        </Alert>
      ) : null}
      {accessToken && !isOwner && !canManageEmail ? (
        <Alert variant="info">
          <AlertDescription>{t('actionsPageForbidden')}</AlertDescription>
        </Alert>
      ) : null}

      {webhookError && isApiUnavailableError(webhookError) ? (
        <ApiUnavailableNotice
          error={webhookError}
          t={t}
        />
      ) : null}
      {webhookError && !isApiUnavailableError(webhookError) ? (
        <Alert variant="destructive">
          <AlertDescription>
            {webhookError instanceof Error ? webhookError.message : t('actionsLoadError')}
          </AlertDescription>
        </Alert>
      ) : null}
      {emailError ? (
        <Alert variant="destructive">
          <AlertDescription>{emailErrorText(t, emailError)}</AlertDescription>
        </Alert>
      ) : null}

      {loading || showList || showEmpty ? (
        <DataTableCard
          label={t('emailServiceRulesTitle')}
          busy={loading}
          toolbar={
            <>
              <h2 className="text-sm font-semibold">
                {sectionTitle(t('emailServiceRulesTitle'), visible.length)}
              </h2>
              {!loading &&
              (canCreateWebhook || canCreateEmail) &&
              listNeedsSearch(merged.length) ? (
                <div className="w-full sm:w-72">
                  <SearchField
                    value={query}
                    onChange={setQuery}
                    label={t('emailServiceRulesSearch')}
                    placeholder={t('actionsSearchPlaceholder')}
                  />
                </div>
              ) : null}
            </>
          }
        >
          {showEmpty ? (
            <EmptyState
              icon={Webhook}
              title={t('emailServiceRulesEmpty')}
              actions={createButtons}
            />
          ) : (
            <TooltipProvider delayDuration={200}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">{t('actionsColName')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('actionsColEvent')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('actionsColSendsTo')}</TableHead>
                    <TableHead className="w-24">{t('actionsColEnabled')}</TableHead>
                    <TableHead className="w-12 pr-4">
                      <span className="sr-only">{t('actionsColActions')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <SkeletonRows
                      rows={4}
                      columns={['pl-4', 'hidden md:table-cell', 'hidden lg:table-cell', '', 'pr-4']}
                    />
                  ) : null}
                  {!loading &&
                    visible.map((row) => {
                      const KindIcon = row.kind === 'email' ? Mail : Webhook;
                      const label = row.kind === 'webhook' ? row.name : row.event;
                      return (
                        <TableRow key={row.key}>
                          <TableCell className="pl-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                                <KindIcon
                                  className="size-4"
                                  aria-hidden
                                />
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Link
                                    to={editPath(row)}
                                    className="truncate font-medium text-foreground no-underline hover:underline"
                                  >
                                    {row.name || row.event}
                                  </Link>
                                  {row.builtIn ? (
                                    <StatusBadge
                                      tone="muted"
                                      dot={false}
                                      title={t('emailRuleBuiltInLocked')}
                                    >
                                      {t('emailRuleBuiltIn')}
                                    </StatusBadge>
                                  ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {row.kind === 'email'
                                    ? t('emailRuleKindEmail')
                                    : t('emailRuleKindWebhook')}
                                  <span className="font-mono md:hidden"> · {row.event}</span>
                                </p>
                                <ActionFeedback feedback={rowFeedback[row.key] ?? null} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden font-mono text-xs md:table-cell">
                            {row.event}
                          </TableCell>
                          <TableCell className="hidden max-w-[16rem] lg:table-cell">
                            <span
                              className="block truncate text-sm text-muted-foreground"
                              title={row.target}
                            >
                              {row.target}
                            </span>
                          </TableCell>
                          <TableCell>
                            {row.builtIn ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="inline-flex items-center gap-1.5"
                                    tabIndex={0}
                                    aria-label={t('emailRuleBuiltInLocked')}
                                  >
                                    <Lock
                                      className="size-3.5 text-muted-foreground"
                                      aria-hidden
                                    />
                                    <StatusBadge tone="success">{t('actionsOn')}</StatusBadge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{t('emailRuleBuiltInLocked')}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Switch
                                checked={row.enabled}
                                disabled={busyKey === row.key}
                                aria-label={label}
                                onCheckedChange={() => void onToggle(row)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  aria-label={t('actionsMoreFor', { name: row.name || row.event })}
                                >
                                  <MoreHorizontal aria-hidden />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => navigate(editPath(row))}>
                                  {t('actionsEdit')}
                                </DropdownMenuItem>
                                {row.builtIn ? null : (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      disabled={busyKey === row.key}
                                      onSelect={() => void onDelete(row)}
                                    >
                                      {t('actionsDelete')}
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {!loading &&
                    removed.map((row) => (
                      <TableRow key={`removed-${row.key}`}>
                        <TableCell
                          colSpan={5}
                          className="px-4"
                        >
                          <ActionFeedback
                            feedback={{
                              tone: 'success',
                              text: t(
                                row.kind === 'webhook' ? 'actionsRuleDeleted' : 'emailRuleDeleted',
                              ),
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </DataTableCard>
      ) : null}
    </div>
  );
}
