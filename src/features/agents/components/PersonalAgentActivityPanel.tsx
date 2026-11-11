import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { MCP_CALL_LOG_PAGE_SIZE, type CompanyMcpCallLogEntry } from '@/lib/companyAgentsApi';
import {
  appendPersonalCallLogs,
  fetchMcpPersonalAgentCallLogs,
  fetchMcpPersonalOauthConsent,
  mergePersonalAgentActivity,
  type McpPersonalConsentRow,
} from '@/lib/personalAgentsApi';
import { formatDurationMs } from '@/lib/scheduledJobsApi';
import { cn } from '@/lib/utils';

const headClass = 'h-9 px-3 text-xs font-medium tracking-normal text-muted-foreground';
const cellClass = 'px-3 py-2 align-middle text-xs';

function formatCallWhen(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function statusBadgeClass(status: string): string {
  if (status === 'allowed') {
    return 'border-border/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  }
  if (status === 'denied' || status === 'waiting_approval') {
    return 'border-border/60 bg-amber-500/10 text-amber-800 dark:text-amber-400';
  }
  return 'border-border/60 bg-red-500/10 text-red-700 dark:text-red-400';
}

function statusLabel(status: string, t: (key: string) => string): string {
  if (status === 'allowed') return t('agentsLogStatusAllowed');
  if (status === 'denied') return t('agentsLogStatusDenied');
  if (status === 'waiting_approval') return t('agentsLogStatusWaiting');
  if (status === 'failed') return t('agentsLogStatusFailed');
  if (status === 'error') return t('agentsLogStatusError');
  return status || '-';
}

function approvalChannelLabel(channel: string, t: (key: string) => string): string {
  if (channel === 'form') return t('agentsLogApprovalChannel_form');
  if (channel === 'link') return t('agentsLogApprovalChannel_link');
  return '';
}

function StatusBadge({ status, children }: { status: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none',
        statusBadgeClass(status),
      )}
    >
      {children}
    </span>
  );
}

function consentTitle(row: McpPersonalConsentRow, t: (key: string) => string): string {
  if (row.tool === 'oauth.authorize.approved') return t('agentsConsentAuthorize');
  if (row.tool === 'oauth.device.approved') return t('agentsConsentDevice');
  return row.operationTitle || row.tool;
}

export function PersonalAgentActivityPanel({
  agentId,
  accessToken,
  companyId,
  locale,
  refreshKey,
}: {
  agentId: string;
  accessToken: string;
  companyId: number;
  locale: string;
  refreshKey: number;
}) {
  const { t } = useTranslation();
  const [calls, setCalls] = useState<CompanyMcpCallLogEntry[]>([]);
  const [callCount, setCallCount] = useState(0);
  const [consents, setConsents] = useState<McpPersonalConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [callsError, setCallsError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const generation = useRef(0);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      const gen = generation.current;
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setCallsError(false);
      }
      const callsTask = fetchMcpPersonalAgentCallLogs(accessToken, agentId, {
        limit: MCP_CALL_LOG_PAGE_SIZE,
        offset,
      });
      const consentTask = append
        ? null
        : fetchMcpPersonalOauthConsent(accessToken, companyId, agentId);

      try {
        const page = await callsTask;
        if (generation.current !== gen) return;
        setCalls((prev) =>
          append ? appendPersonalCallLogs(prev, page.call_logs) : page.call_logs,
        );
        setCallCount(page.count);
        setCallsError(false);
      } catch {
        if (generation.current !== gen) return;
        if (!append) {
          setCalls([]);
          setCallCount(0);
        }
        setCallsError(true);
      }

      if (consentTask) {
        try {
          const rows = await consentTask;
          if (generation.current !== gen) return;
          setConsents(rows);
        } catch {
          if (generation.current !== gen) return;
          setConsents([]);
        }
      }

      if (generation.current === gen) {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken, agentId, companyId],
  );

  useEffect(() => {
    generation.current += 1;
    setCalls([]);
    setConsents([]);
    setCallCount(0);
    setCallsError(false);
    void loadPage(0, false);
  }, [loadPage, refreshKey, reloadKey]);

  const timeline = useMemo(() => mergePersonalAgentActivity(calls, consents), [calls, consents]);
  const hasMore = calls.length > 0 && calls.length < callCount;

  return (
    <div className="border-t border-border bg-muted/40 px-4 py-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t('agentsCallLog')}</p>
      {callsError ? (
        <Alert
          variant="destructive"
          className="mb-3"
        >
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{t('agentsPersonalCallsUnavailable')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              {t('agentsCallLogRetry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && timeline.length === 0 ? (
        <p
          className="py-8 text-center text-xs text-muted-foreground"
          role="status"
        >
          {t('agentsCallLogLoading')}
        </p>
      ) : timeline.length === 0 && !callsError ? (
        <p
          className="py-8 text-center text-xs text-muted-foreground"
          role="status"
        >
          {t('agentsCallLogEmptyRange')}
        </p>
      ) : timeline.length === 0 ? null : (
        <>
          {callCount > 0 ? (
            <p className="mb-2 text-[11px] tabular-nums text-muted-foreground">
              {t('agentsCallLogShown', { shown: calls.length, count: callCount })}
            </p>
          ) : null}
          <div className="overflow-hidden rounded-md border border-border bg-background">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={headClass}>{t('agentsCallColWhen')}</TableHead>
                  <TableHead className={headClass}>{t('agentsCallColService')}</TableHead>
                  <TableHead className={headClass}>{t('agentsCallColTool')}</TableHead>
                  <TableHead className={headClass}>{t('agentsCallColStatus')}</TableHead>
                  <TableHead className={cn(headClass, 'text-right')}>
                    {t('agentsCallColDuration')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeline.map((entry) => {
                  if (entry.kind === 'consent') {
                    const row = entry.consent;
                    return (
                      <TableRow key={`consent-${row.tool}-${row.timestamp}`}>
                        <TableCell
                          className={cn(
                            cellClass,
                            'whitespace-nowrap tabular-nums text-muted-foreground',
                          )}
                        >
                          {formatCallWhen(row.timestamp, locale)}
                        </TableCell>
                        <TableCell className={cellClass}>
                          <Badge
                            variant="muted"
                            className="px-1.5 py-0 text-[11px] font-normal"
                          >
                            {row.service}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn(cellClass, 'max-w-[18rem] text-foreground')}>
                          <span className="block truncate font-medium">{consentTitle(row, t)}</span>
                        </TableCell>
                        <TableCell className={cellClass}>
                          <StatusBadge status={row.outcome === 'denied' ? 'denied' : 'allowed'}>
                            {statusLabel(row.outcome === 'denied' ? 'denied' : 'allowed', t)}
                          </StatusBadge>
                        </TableCell>
                        <TableCell
                          className={cn(
                            cellClass,
                            'text-right font-mono tabular-nums text-muted-foreground',
                          )}
                        >
                          {formatDurationMs(row.durationMs, locale) ?? '-'}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const call = entry.call;
                  const toolLabel = call.tool_name || call.operation_title || '-';
                  const wrapper = call.wrapper_tool.trim();
                  const channelLabel = approvalChannelLabel(call.approval_channel, t);
                  const outcomeLabel = call.approval_outcome.trim().replace(/_/g, ' ');
                  const failureText =
                    call.status === 'failed' || call.status === 'error'
                      ? call.error_message.trim() || call.error_code.trim()
                      : '';
                  return (
                    <TableRow key={`call-${call.id}`}>
                      <TableCell
                        className={cn(
                          cellClass,
                          'whitespace-nowrap tabular-nums text-muted-foreground',
                        )}
                        title={call.created_at}
                      >
                        {formatCallWhen(call.created_at, locale)}
                      </TableCell>
                      <TableCell className={cellClass}>
                        {call.service && call.service !== '-' ? (
                          <Badge
                            variant="muted"
                            className="px-1.5 py-0 text-[11px] font-normal"
                          >
                            {call.service}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className={cn(cellClass, 'max-w-[18rem] text-foreground')}>
                        <span
                          className="block truncate font-mono font-medium"
                          title={toolLabel === '-' ? undefined : toolLabel}
                        >
                          {toolLabel}
                        </span>
                        {wrapper === 'ai_call_tool' ? (
                          <span className="mt-0.5 block font-sans text-[11px] font-normal text-muted-foreground">
                            {t('agentsLogViaWrapper', { tool: wrapper })}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className={cn(cellClass, 'max-w-[18rem]')}>
                        <StatusBadge status={call.status}>
                          {statusLabel(call.status, t)}
                        </StatusBadge>
                        {channelLabel || outcomeLabel ? (
                          <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                            {channelLabel}
                            {channelLabel && outcomeLabel ? ' · ' : null}
                            {outcomeLabel || null}
                          </span>
                        ) : null}
                        {failureText ? (
                          <span className="mt-1 block whitespace-normal text-[11px] font-normal text-red-700 dark:text-red-400">
                            {failureText}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell
                        className={cn(
                          cellClass,
                          'text-right font-mono tabular-nums text-muted-foreground',
                        )}
                      >
                        {formatDurationMs(call.duration_ms, locale) ?? '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {hasMore ? (
            <div className="mt-2 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={loadingMore}
                onClick={() => void loadPage(calls.length, true)}
              >
                {loadingMore ? t('agentsCallLogLoading') : t('agentsCallLogLoadMore')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
