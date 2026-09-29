import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, createSearchParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { Text } from '@/components/ui/text';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { cn } from '@/lib/utils';
import { ActionsSubNav } from '@/features/actions/components/ActionsSubNav';
import {
  ApiUnavailableNotice,
  isApiUnavailableError,
} from '@/features/actions/components/ApiUnavailableNotice';
import { useActionsApi } from '@/features/actions/useActionsApi';
import type { ActionDelivery } from '@/features/actions/types';

const PAGE_SIZE = 20;

function statusClassName(status: string) {
  const s = status.toLowerCase();
  if (s === 'success') return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
  if (s === 'pending' || s === 'processing') return 'bg-sky-500/15 text-sky-900 dark:text-sky-100';
  if (s === 'failed' || s === 'dead') return 'bg-destructive/15 text-destructive';
  return 'bg-muted text-muted-foreground';
}

export function ActionsDeliveriesListPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useShelluiAccessToken();
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const { api } = useActionsApi(accessToken);

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

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('actionsDeliveriesTitle')}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            {t('actionsBadge')}
          </Badge>
        </div>
        <Text className="max-w-3xl text-sm text-muted-foreground">
          {t('actionsDeliveriesDescription')}
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
          {error instanceof Error ? error.message : t('actionsLoadError')}
        </Text>
      ) : null}

      {accessToken && isOwner && api ? (
        <div className="grid gap-3 rounded-md border border-border/80 p-4 sm:grid-cols-4">
          <Input
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value)}
            placeholder={t('actionsFilterStatus')}
            className="font-mono text-xs"
          />
          <Input
            value={draftEvent}
            onChange={(e) => setDraftEvent(e.target.value)}
            placeholder={t('actionsFilterEvent')}
            className="font-mono text-xs"
          />
          <Input
            value={draftRuleId}
            onChange={(e) => setDraftRuleId(e.target.value)}
            placeholder={t('actionsFilterRuleId')}
            className="font-mono text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={applyFilters}
          >
            {t('loginEventsApplyFilters')}
          </Button>
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

      {!loading &&
      rows.length === 0 &&
      accessToken &&
      isOwner &&
      api &&
      !isApiUnavailableError(error) ? (
        <Text className="py-8 text-center font-mono text-sm text-muted-foreground">
          {t('actionsDeliveriesEmpty')}
        </Text>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs uppercase">{t('usersColId')}</TableHead>
                  <TableHead className="text-xs uppercase">{t('actionsColStatus')}</TableHead>
                  <TableHead className="text-xs uppercase">{t('actionsColEvent')}</TableHead>
                  <TableHead className="text-xs uppercase">{t('actionsColRule')}</TableHead>
                  <TableHead className="text-xs uppercase">{t('actionsColAttempts')}</TableHead>
                  <TableHead className="text-xs uppercase">{t('actionsColCreated')}</TableHead>
                  <TableHead className="text-xs uppercase">{t('actionsColLastError')}</TableHead>
                  <TableHead className="text-right text-xs uppercase">
                    {t('usersColActions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono text-xs">
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 font-medium',
                          statusClassName(row.status),
                        )}
                      >
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell>{row.event}</TableCell>
                    <TableCell>{row.rule_name || row.rule_id}</TableCell>
                    <TableCell>{row.attempts_count}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell
                      className="max-w-[12rem] truncate"
                      title={row.last_error || undefined}
                    >
                      {row.last_error || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/webhooks/deliveries/${row.id}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {t('loginEventsOpenDetail')}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {t('loginEventsPageStatus', { page: pageParam, pages: totalPages, total })}
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
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
