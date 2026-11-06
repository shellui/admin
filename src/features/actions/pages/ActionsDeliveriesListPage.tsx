import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, createSearchParams, useSearchParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import { DataTableCard, SkeletonRows } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge, type StatusTone } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { ActionsSubNav } from '@/features/actions/components/ActionsSubNav';
import {
  ApiUnavailableNotice,
  isApiUnavailableError,
} from '@/features/actions/components/ApiUnavailableNotice';
import { useActionsApi } from '@/features/actions/useActionsApi';
import { WebhookServiceUnavailable } from '@/features/actions/components/WebhookServiceUnavailable';
import { useWebhookPageMeta } from '@/features/actions/useWebhookPageMeta';
import type { ActionDelivery } from '@/features/actions/types';
import { webhookDeliveryDetailPath } from '@/lib/webhookRoutePaths';

const PAGE_SIZE = 20;

function deliveryStatusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s === 'success') return 'success';
  if (s === 'pending' || s === 'processing') return 'info';
  if (s === 'failed' || s === 'dead') return 'destructive';
  return 'muted';
}

export function ActionsDeliveriesListPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const { service, serviceConfigured } = useWebhookPageMeta();
  const { api } = useActionsApi(accessToken, service.key);

  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const statusFilter = searchParams.get('status') || '';
  const eventFilter = searchParams.get('event_type') || searchParams.get('event') || '';
  const ruleFilter = searchParams.get('action_rule_id') || searchParams.get('rule_id') || '';

  const [rows, setRows] = useState<ActionDelivery[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const [draftStatus, setDraftStatus] = useState(statusFilter);
  const [draftEvent, setDraftEvent] = useState(eventFilter);
  const [draftRuleId, setDraftRuleId] = useState(ruleFilter);

  useEffect(() => {
    setDraftStatus(statusFilter);
    setDraftEvent(eventFilter);
    setDraftRuleId(ruleFilter);
  }, [statusFilter, eventFilter, ruleFilter]);

  const load = useCallback(async () => {
    if (!api || !isOwner) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const parsedRuleId = ruleFilter.trim() ? Number.parseInt(ruleFilter, 10) : undefined;
      const res = await api.fetchDeliveries({
        page: pageParam,
        page_size: PAGE_SIZE,
        status: statusFilter || undefined,
        event_type: eventFilter || undefined,
        action_rule_id: Number.isFinite(parsedRuleId) ? parsedRuleId : undefined,
      });
      setRows(res.results);
      setTotal(res.count);
    } catch (e) {
      setRows([]);
      setTotal(0);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [api, eventFilter, isOwner, pageParam, ruleFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(i18n.language || 'en', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  };

  function applyFilters() {
    const next: Record<string, string> = { page: '1' };
    if (draftStatus.trim()) next.status = draftStatus.trim();
    if (draftEvent.trim()) next.event_type = draftEvent.trim();
    if (draftRuleId.trim()) next.action_rule_id = draftRuleId.trim();
    setSearchParams(createSearchParams(next));
  }

  function goToPage(page: number) {
    const next: Record<string, string> = { page: String(page) };
    if (statusFilter) next.status = statusFilter;
    if (eventFilter) next.event_type = eventFilter;
    if (ruleFilter) next.action_rule_id = ruleFilter;
    setSearchParams(createSearchParams(next));
  }

  const canList = Boolean(serviceConfigured && accessToken && isOwner && api);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t(service.deliveriesPageTitleKey)}
        service={t(service.badgeKey)}
        description={t('actionsDeliveriesDescription')}
      />

      <ActionsSubNav />

      {!serviceConfigured ? <WebhookServiceUnavailable serviceKey={service.key} /> : null}

      {!accessToken && (
        <Alert variant="info">
          <AlertDescription>{t('dashboardNoSession')}</AlertDescription>
        </Alert>
      )}
      {accessToken && !isOwner && (
        <Alert variant="warning">
          <AlertDescription>{t('actionsPageForbidden')}</AlertDescription>
        </Alert>
      )}

      {error && isApiUnavailableError(error) ? (
        <ApiUnavailableNotice
          error={error}
          t={t}
        />
      ) : null}
      {error && !isApiUnavailableError(error) ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error instanceof Error ? error.message : t('actionsLoadError')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
            >
              {t('usersRetry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {canList ? (
        <DataTableCard
          label={t(service.deliveriesPageTitleKey)}
          busy={loading}
          toolbar={
            <form
              className="grid w-full gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                applyFilters();
              }}
            >
              <Input
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
                placeholder={t('actionsFilterStatus')}
                aria-label={t('actionsFilterStatus')}
                className="h-8 font-mono text-xs"
              />
              <Input
                value={draftEvent}
                onChange={(e) => setDraftEvent(e.target.value)}
                placeholder={t('actionsFilterEvent')}
                aria-label={t('actionsFilterEvent')}
                className="h-8 font-mono text-xs"
              />
              <Input
                value={draftRuleId}
                onChange={(e) => setDraftRuleId(e.target.value)}
                placeholder={t('actionsFilterRuleId')}
                aria-label={t('actionsFilterRuleId')}
                className="h-8 font-mono text-xs"
              />
              <Button
                type="submit"
                size="sm"
              >
                {t('eventsApplyFilters')}
              </Button>
            </form>
          }
          footer={
            totalPages > 1 ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {t('eventsPageStatus', { page: pageParam, pages: totalPages, total })}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pageParam <= 1 || loading}
                    onClick={() => goToPage(pageParam - 1)}
                  >
                    {t('usersPrevPage')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pageParam >= totalPages || loading}
                    onClick={() => goToPage(pageParam + 1)}
                  >
                    {t('usersNextPage')}
                  </Button>
                </div>
              </>
            ) : undefined
          }
        >
          {loading && rows.length === 0 ? (
            <SkeletonRows
              rows={6}
              columns={['w-16', 'w-20', 'w-40', 'w-24', 'w-28']}
            />
          ) : rows.length === 0 ? (
            isApiUnavailableError(error) ? null : (
              <EmptyState
                icon={Send}
                title={t('actionsDeliveriesEmpty')}
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">{t('usersColId')}</TableHead>
                  <TableHead>{t('actionsColStatus')}</TableHead>
                  <TableHead>{t('actionsColEvent')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('actionsColRule')}</TableHead>
                  <TableHead>{t('actionsColAttempts')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('actionsColCreated')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('actionsColLastError')}</TableHead>
                  <TableHead className="text-right">{t('usersColActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {row.id}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={deliveryStatusTone(row.status)}>{row.status}</StatusBadge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.event}</TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      {row.rule_name || row.rule_id}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.attempts_count}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground lg:table-cell">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell
                      className="hidden max-w-56 truncate font-mono text-xs text-muted-foreground lg:table-cell"
                      title={row.last_error || undefined}
                    >
                      {row.last_error || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                      >
                        <Link to={webhookDeliveryDetailPath(service.key, row.id)}>
                          {t('eventsOpenDetail')}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataTableCard>
      ) : null}
    </div>
  );
}
