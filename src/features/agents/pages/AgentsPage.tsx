import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, ChevronRight, Loader2 } from 'lucide-react';
import shellui from '@shellui/sdk';
import { PageHeader } from '@/components/admin/PageHeader';
import { EmptyState } from '@/components/admin/EmptyState';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { useEventLogSource, useEventRetention } from '@/hooks/useEventRetention';
import { getCompanyIdFromJwt, getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { onAgentsChanged, openAgentConnectDrawer } from '@/lib/agentConnectDrawer';
import { PersonalAgentActivityPanel } from '@/features/agents/components/PersonalAgentActivityPanel';
import { connectionKindLines, mergeCompanyAndPersonalAgents } from '@/lib/mcpAgentsConnect';
import {
  fetchMcpPersonalAgents,
  revokeMcpPersonalAgent,
  type McpPersonalAgent,
} from '@/lib/personalAgentsApi';
import { AiServiceNotConfiguredError } from '@/lib/aiServiceUrl';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import {
  agentCreatorDisplayName,
  agentDisplayStatus,
  approveCompanyMcpApproval,
  fetchCompanyMcpAgents,
  fetchCompanyMcpApprovals,
  fetchCompanyMcpCallLogs,
  formatApprovalArgumentsForConfirm,
  isDestructiveMcpApproval,
  isMcpApiUnavailable,
  MCP_API_UNAVAILABLE,
  MCP_CALL_LOG_PAGE_SIZE,
  MCP_CALL_LOG_SERVICES,
  MCP_CALL_LOG_STATUSES,
  mcpApprovalHasRedactedArguments,
  rejectCompanyMcpApproval,
  revokeCompanyMcpAgent,
  type CompanyMcpAgent,
  type CompanyMcpApproval,
  type CompanyMcpCallLogEntry,
  type McpCallLogService,
  type McpCallLogStatus,
} from '@/lib/companyAgentsApi';
import { formatDurationMs } from '@/lib/scheduledJobsApi';
import { cn } from '@/lib/utils';

type AgentStatusFilter = 'all' | 'active' | 'paused';
type CallLogStatusFilter = 'any' | McpCallLogStatus;
type CallLogServiceFilter = 'any' | McpCallLogService;
type CallLogTimeFilter = '7d' | '30d' | 'all';

const CREATOR_ANY = '__any__';

function formatDateOnly(iso: string | null | undefined, locale: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
}

function formatCallWhen(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function formatCountdown(expiresAt: string, nowMs: number): string {
  const ms = new Date(expiresAt).getTime() - nowMs;
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function agentMatchesListFilters(
  agent: CompanyMcpAgent,
  search: string,
  statusFilter: AgentStatusFilter,
  creatorFilter: string,
): boolean {
  const status = agentDisplayStatus(agent);
  if (status === 'revoked') return false;

  if (statusFilter === 'active' && status !== 'active') return false;
  if (statusFilter === 'paused' && status !== 'paused') return false;

  if (creatorFilter !== CREATOR_ANY) {
    const creator = agentCreatorDisplayName(agent);
    if ((creator ?? '') !== creatorFilter) return false;
  }

  const q = search.trim().toLowerCase();
  if (q && !agent.name.toLowerCase().includes(q)) return false;

  return true;
}

function filterCallLogRows(
  rows: CompanyMcpCallLogEntry[],
  search: string,
): CompanyMcpCallLogEntry[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    [
      row.service,
      row.tool_name,
      row.wrapper_tool,
      row.error_message,
      row.operation_title,
      row.approval_outcome,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}

function createdAfterForTimeFilter(filter: CallLogTimeFilter, nowMs: number): string | undefined {
  if (filter === 'all') return undefined;
  const days = filter === '7d' ? 7 : 30;
  return new Date(nowMs - days * 24 * 60 * 60 * 1000).toISOString();
}

function appendCallLogs(
  prev: CompanyMcpCallLogEntry[],
  next: CompanyMcpCallLogEntry[],
): CompanyMcpCallLogEntry[] {
  if (next.length === 0) return prev;
  const seen = new Set(prev.map((row) => row.id));
  const extra = next.filter((row) => !seen.has(row.id));
  return extra.length === 0 ? prev : [...prev, ...extra];
}

const callLogTableHeadClass = 'h-9 px-3 text-xs font-medium tracking-normal text-muted-foreground';
const callLogTableCellClass = 'px-3 py-2 align-middle text-xs';

function callLogStatusBadgeClass(status: string): string {
  if (status === 'allowed') {
    return 'border-border/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  }
  if (status === 'denied' || status === 'waiting_approval') {
    return 'border-border/60 bg-amber-500/10 text-amber-800 dark:text-amber-400';
  }
  return 'border-border/60 bg-red-500/10 text-red-700 dark:text-red-400';
}

function callLogStatusLabel(status: string, t: (key: string) => string): string {
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

function CallLogStatusBadge({ status, children }: { status: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none',
        callLogStatusBadgeClass(status),
      )}
    >
      {children}
    </span>
  );
}

function AgentCallLogPanel({
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
  const [logSearch, setLogSearch] = useState('');
  const [logStatus, setLogStatus] = useState<CallLogStatusFilter>('any');
  const [logService, setLogService] = useState<CallLogServiceFilter>('any');
  const [logTime, setLogTime] = useState<CallLogTimeFilter>('7d');
  const [nowMs] = useState(() => Date.now());
  const [rows, setRows] = useState<CompanyMcpCallLogEntry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const generation = useRef(0);
  const tRef = useRef(t);
  tRef.current = t;

  const createdAfter = createdAfterForTimeFilter(logTime, nowMs);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      const gen = generation.current;
      const translate = tRef.current;
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const page = await fetchCompanyMcpCallLogs(accessToken, companyId, {
          agent: agentId,
          service: logService === 'any' ? undefined : logService,
          status: logStatus === 'any' ? undefined : logStatus,
          createdAfter,
          limit: MCP_CALL_LOG_PAGE_SIZE,
          offset,
        });
        if (generation.current !== gen) return;
        setRows((prev) => (append ? appendCallLogs(prev, page.call_logs) : page.call_logs));
        setCount(page.count);
        setError(null);
      } catch (e) {
        if (generation.current !== gen) return;
        const message =
          e instanceof AiServiceNotConfiguredError
            ? translate('agentsConnectMissingUrl')
            : e instanceof Error && e.message
              ? e.message
              : translate('agentsCallLogLoadError');
        setError(message);
        if (!append) setRows([]);
      } finally {
        if (generation.current === gen) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [accessToken, agentId, companyId, createdAfter, logService, logStatus],
  );

  useEffect(() => {
    generation.current += 1;
    setLoading(true);
    setError(null);
    setRows([]);
    setCount(0);
    void loadPage(0, false);
  }, [loadPage, refreshKey, reloadKey]);

  const visible = useMemo(() => filterCallLogRows(rows, logSearch), [logSearch, rows]);
  const hasMore = rows.length > 0 && rows.length < count;

  return (
    <div className="border-t border-border bg-muted/40 px-4 py-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t('agentsCallLog')}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          value={logSearch}
          onChange={(e) => setLogSearch(e.target.value)}
          placeholder={t('agentsSearchToolsPlaceholder')}
          className="h-8 min-w-[200px] max-w-xs text-xs"
          aria-label={t('agentsSearchToolsPlaceholder')}
        />
        <Select
          value={logService}
          onValueChange={(v) => setLogService(v as CallLogServiceFilter)}
        >
          <SelectTrigger
            className="h-8 w-[150px] text-xs"
            aria-label={t('agentsCallColService')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t('agentsLogFilterAnyService')}</SelectItem>
            {MCP_CALL_LOG_SERVICES.map((service) => (
              <SelectItem
                key={service}
                value={service}
              >
                {t(`agentsService_${service}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={logStatus}
          onValueChange={(v) => setLogStatus(v as CallLogStatusFilter)}
        >
          <SelectTrigger
            className="h-8 w-[170px] text-xs"
            aria-label={t('agentsCallColStatus')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t('agentsLogFilterAnyStatus')}</SelectItem>
            {MCP_CALL_LOG_STATUSES.map((status) => (
              <SelectItem
                key={status}
                value={status}
              >
                {callLogStatusLabel(status, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={logTime}
          onValueChange={(v) => setLogTime(v as CallLogTimeFilter)}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">{t('agentsLogTimeLast7')}</SelectItem>
            <SelectItem value="30d">{t('agentsLogTimeLast30')}</SelectItem>
            <SelectItem value="all">{t('agentsLogTimeAll')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <Alert
          variant="destructive"
          className="mb-3"
        >
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setReloadKey((n) => n + 1)}
            >
              {t('agentsCallLogRetry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && rows.length === 0 ? (
        <p
          className="py-8 text-center text-xs text-muted-foreground"
          role="status"
        >
          {t('agentsCallLogLoading')}
        </p>
      ) : rows.length === 0 && !error ? (
        <p
          className="py-8 text-center text-xs text-muted-foreground"
          role="status"
        >
          {t('agentsCallLogEmptyRange')}
        </p>
      ) : rows.length === 0 ? null : (
        <>
          <p className="mb-2 text-[11px] tabular-nums text-muted-foreground">
            {t('agentsCallLogShown', { shown: rows.length, count })}
          </p>
          <div className="overflow-hidden rounded-md border border-border bg-background">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={callLogTableHeadClass}>{t('agentsCallColWhen')}</TableHead>
                  <TableHead className={callLogTableHeadClass}>
                    {t('agentsCallColService')}
                  </TableHead>
                  <TableHead className={callLogTableHeadClass}>{t('agentsCallColTool')}</TableHead>
                  <TableHead className={callLogTableHeadClass}>
                    {t('agentsCallColStatus')}
                  </TableHead>
                  <TableHead className={cn(callLogTableHeadClass, 'text-right')}>
                    {t('agentsCallColDuration')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-xs text-muted-foreground"
                    >
                      {t('agentsCallLogEmptySearch')}
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((entry) => {
                    const toolLabel = entry.tool_name || entry.operation_title || '-';
                    const wrapper = entry.wrapper_tool.trim();
                    const channelLabel = approvalChannelLabel(entry.approval_channel, t);
                    const outcomeLabel = entry.approval_outcome.trim().replaceAll('_', ' ');
                    const failureText =
                      entry.status === 'failed' || entry.status === 'error'
                        ? entry.error_message.trim() || entry.error_code.trim()
                        : '';
                    return (
                      <TableRow key={entry.id}>
                        <TableCell
                          className={cn(
                            callLogTableCellClass,
                            'whitespace-nowrap tabular-nums text-muted-foreground',
                          )}
                          title={entry.created_at}
                        >
                          {formatCallWhen(entry.created_at, locale)}
                        </TableCell>
                        <TableCell className={callLogTableCellClass}>
                          {entry.service && entry.service !== '-' ? (
                            <Badge
                              variant="muted"
                              className="px-1.5 py-0 text-[11px] font-normal"
                            >
                              {entry.service}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(callLogTableCellClass, 'max-w-[18rem] text-foreground')}
                        >
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
                        <TableCell className={cn(callLogTableCellClass, 'max-w-[18rem]')}>
                          <CallLogStatusBadge status={entry.status}>
                            {callLogStatusLabel(entry.status, t)}
                          </CallLogStatusBadge>
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
                            callLogTableCellClass,
                            'text-right font-mono tabular-nums text-muted-foreground',
                          )}
                        >
                          {formatDurationMs(entry.duration_ms, locale) ?? '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
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
                onClick={() => void loadPage(rows.length, true)}
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

function AgentAccordionRow({
  agent,
  expanded,
  onToggle,
  accessToken,
  companyId,
  logsRefreshKey,
  locale,
  readOnly,
  busy,
  onRevoke,
  personal,
}: {
  agent: CompanyMcpAgent;
  expanded: boolean;
  onToggle: () => void;
  accessToken: string;
  companyId: number;
  logsRefreshKey: number;
  locale: string;
  readOnly: boolean;
  busy: boolean;
  onRevoke: () => void;
  /** Agent the signed-in member owns. Call logs come from ai-service, not the company drawer. */
  personal: boolean;
}) {
  const { t } = useTranslation();
  const status = agentDisplayStatus(agent);
  const creator = agentCreatorDisplayName(agent);
  const createdMeta = creator
    ? t('agentsCreatedBy', {
        name: creator,
        date: formatDateOnly(agent.created_at, locale),
      })
    : t('agentsCreatedByUnknown', { date: formatDateOnly(agent.created_at, locale) });
  const kindLines = connectionKindLines(agent, {
    oauth: t('agentsKindOauth'),
    personal: t('agentsKindPersonal'),
    services: (services) => t('agentsKindServices', { services }),
    scopeRegional: t('agentsScopeRegional'),
    scopeRegionalSaas: t('agentsScopeRegionalSaas'),
  });
  const callCount =
    typeof agent.call_count === 'number' && Number.isFinite(agent.call_count)
      ? agent.call_count
      : null;

  const statusTone = status === 'active' ? 'success' : status === 'paused' ? 'warning' : 'muted';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[10px] border border-border bg-card',
        readOnly && 'opacity-[0.72] bg-muted/30',
      )}
    >
      <div className="grid grid-cols-[28px_1.4fr_auto_auto_auto_auto] items-center gap-3 px-3.5 py-3 sm:grid-cols-[28px_minmax(0,1.4fr)_auto_auto_auto_auto]">
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60"
          aria-expanded={expanded}
          aria-label={expanded ? t('agentsCollapseAgent') : t('agentsExpandAgent')}
          onClick={onToggle}
        >
          <ChevronRight
            className={cn(
              'size-4 transition-transform motion-reduce:transition-none',
              expanded && 'rotate-90',
            )}
            aria-hidden
          />
        </button>
        <button
          type="button"
          className="min-w-0 text-left"
          onClick={onToggle}
        >
          <p className="text-sm font-semibold text-foreground">{agent.name}</p>
          <p className="text-xs text-muted-foreground">{createdMeta}</p>
          {kindLines.map((line) => (
            <p
              key={line}
              className="text-xs text-muted-foreground"
            >
              {line}
            </p>
          ))}
        </button>
        <StatusBadge tone={statusTone}>{t(`agentsStatus_${status}`)}</StatusBadge>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {agent.expires_at
            ? t('agentsExpires', { date: formatDateOnly(agent.expires_at, locale) })
            : '-'}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {callCount == null ? '-' : t('agentsCallCount', { count: callCount })}
        </p>
        {!readOnly && status !== 'revoked' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onRevoke();
            }}
          >
            {busy ? (
              <Loader2
                className="size-4 animate-spin"
                aria-hidden
              />
            ) : (
              t('agentsRevoke')
            )}
          </Button>
        ) : (
          <span aria-hidden />
        )}
      </div>
      {expanded ? (
        personal ? (
          <PersonalAgentActivityPanel
            agentId={agent.id}
            accessToken={accessToken}
            companyId={companyId}
            locale={locale}
            refreshKey={logsRefreshKey}
          />
        ) : (
          <AgentCallLogPanel
            agentId={agent.id}
            accessToken={accessToken}
            companyId={companyId}
            locale={locale}
            refreshKey={logsRefreshKey}
          />
        )
      ) : null}
    </div>
  );
}

export function AgentsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const accessToken = useShelluiAccessToken();
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));

  const identityRetention = useEventRetention(useEventLogSource('identity'), accessToken);

  const [agents, setAgents] = useState<CompanyMcpAgent[]>([]);
  const [approvals, setApprovals] = useState<CompanyMcpApproval[]>([]);
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgentStatusFilter>('active');
  const [creatorFilter, setCreatorFilter] = useState(CREATOR_ANY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [mcpUnavailable, setMcpUnavailable] = useState(false);
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);
  const [personalIds, setPersonalIds] = useState<Set<string>>(() => new Set());
  const [nowMs, setNowMs] = useState(() => Date.now());

  const applyPersonalRows = useCallback(
    (companyRows: CompanyMcpAgent[], personalRows: McpPersonalAgent[]) => {
      const merged = mergeCompanyAndPersonalAgents(companyRows, personalRows);
      setAgents(merged.agents);
      setPersonalIds(merged.personalIds);
    },
    [],
  );

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!accessToken || companyId == null || !isOwner) {
        setLoading(false);
        return;
      }
      if (!options?.silent) {
        setLoading(true);
        setError(null);
        setMcpUnavailable(false);
      }
      const personalPromise = fetchMcpPersonalAgents(accessToken, companyId).catch(
        () => [] as McpPersonalAgent[],
      );
      try {
        const [agentRows, approvalRows] = await Promise.all([
          fetchCompanyMcpAgents(accessToken, companyId),
          fetchCompanyMcpApprovals(accessToken, companyId),
        ]);
        const personalRows = await personalPromise;
        applyPersonalRows(agentRows, personalRows);
        setApprovals(approvalRows);
        setError(null);
        setMcpUnavailable(false);
      } catch (e) {
        const personalRows = await personalPromise;
        if (personalRows.length > 0) {
          applyPersonalRows([], personalRows);
          setApprovals([]);
          setMcpUnavailable(false);
          setError(isMcpApiUnavailable(e) ? null : e);
        } else if (!options?.silent) {
          if (isMcpApiUnavailable(e)) {
            setMcpUnavailable(true);
            setAgents([]);
            setPersonalIds(new Set());
            setApprovals([]);
            setError(null);
          } else {
            setError(e);
          }
        }
      } finally {
        if (!options?.silent) setLoading(false);
        setLogsRefreshKey((n) => n + 1);
      }
    },
    [accessToken, applyPersonalRows, companyId, isOwner],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => onAgentsChanged(() => void load({ silent: true })), [load]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'hidden') return;
      void load({ silent: true });
    };
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const revokedAgents = useMemo(
    () => agents.filter((a) => agentDisplayStatus(a) === 'revoked'),
    [agents],
  );

  const hasPausedAgents = useMemo(
    () => agents.some((a) => agentDisplayStatus(a) === 'paused'),
    [agents],
  );

  const creatorOptions = useMemo(() => {
    const names = new Set<string>();
    for (const agent of agents) {
      const name = agentCreatorDisplayName(agent);
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [agents]);

  const filteredActiveAgents = useMemo(
    () =>
      agents.filter((agent) =>
        agentMatchesListFilters(agent, agentSearch, statusFilter, creatorFilter),
      ),
    [agents, agentSearch, statusFilter, creatorFilter],
  );

  const listHasFilters =
    agentSearch.trim() !== '' || statusFilter !== 'all' || creatorFilter !== CREATOR_ANY;

  async function confirmApprovalDecision(
    approval: CompanyMcpApproval,
    decision: 'approve' | 'reject',
  ): Promise<boolean> {
    const argsJson = formatApprovalArgumentsForConfirm(approval);
    const destructive = isDestructiveMcpApproval(approval);
    return askShelluiConfirm({
      title:
        decision === 'approve'
          ? t('agentsApprovalConfirmApproveTitle', { action: approval.action })
          : t('agentsApprovalConfirmRejectTitle', { action: approval.action }),
      description: t('agentsApprovalConfirmDescription', { arguments: argsJson }),
      okLabel: decision === 'approve' ? t('agentsApprove') : t('agentsReject'),
      cancelLabel: t('actionsCancel'),
      mode: decision === 'approve' && destructive ? 'delete' : 'confirm',
    });
  }

  async function onResolveApproval(approval: CompanyMcpApproval, decision: 'approve' | 'reject') {
    if (!accessToken || companyId == null) return;
    if (decision === 'approve' && !mcpApprovalHasRedactedArguments(approval)) {
      shellui.toast({ type: 'error', title: t('agentsApprovalArgsMissing') });
      return;
    }
    const ok = await confirmApprovalDecision(approval, decision);
    if (!ok) return;
    setBusyApprovalId(approval.id);
    try {
      if (decision === 'approve') {
        await approveCompanyMcpApproval(accessToken, companyId, approval.id);
      } else {
        await rejectCompanyMcpApproval(accessToken, companyId, approval.id);
      }
      setApprovals((rows) => rows.filter((a) => a.id !== approval.id));
    } catch (e) {
      shellui.toast({
        type: 'error',
        title: e instanceof Error ? e.message : t('agentsSaveError'),
      });
    } finally {
      setBusyApprovalId(null);
    }
  }

  async function onRevoke(agent: CompanyMcpAgent) {
    if (!accessToken || companyId == null) return;
    const ok = await askShelluiConfirm({
      title: t('agentsRevokeConfirmTitle'),
      description: t('agentsRevokeConfirmDescription'),
      okLabel: t('agentsRevoke'),
      cancelLabel: t('actionsCancel'),
      mode: 'delete',
    });
    if (!ok) return;
    setBusyAgentId(agent.id);
    try {
      if (personalIds.has(agent.id)) {
        const revoked = await revokeMcpPersonalAgent(accessToken, companyId, agent.id);
        setAgents((rows) =>
          rows.map((a) =>
            a.id === agent.id
              ? {
                  ...a,
                  revoked_at: revoked.revoked_at,
                  is_active: revoked.is_active,
                  paused_at: revoked.paused_at,
                  kind: revoked.kind,
                  services_allowed: revoked.services_allowed,
                }
              : a,
          ),
        );
      } else {
        const updated = await revokeCompanyMcpAgent(accessToken, companyId, agent.id);
        setAgents((rows) =>
          rows.map((a) =>
            a.id === updated.id ? { ...a, ...updated, kind: updated.kind ?? a.kind } : a,
          ),
        );
      }
      if (expandedAgentId === agent.id) setExpandedAgentId(null);
    } catch (e) {
      shellui.toast({
        type: 'error',
        title: e instanceof Error ? e.message : t('agentsSaveError'),
      });
    } finally {
      setBusyAgentId(null);
    }
  }

  function toggleAgentExpand(agentId: string) {
    setExpandedAgentId((prev) => (prev === agentId ? null : agentId));
  }

  const retentionDays = identityRetention?.data_retention_days;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('agentsPageTitle')}
        description={t('agentsPageDescription')}
        actions={
          accessToken && isOwner && !mcpUnavailable ? (
            <Button
              type="button"
              size="sm"
              onClick={() => openAgentConnectDrawer()}
            >
              {t('agentsConnectOpen')}
            </Button>
          ) : null
        }
      />

      {!accessToken && <p className="text-sm text-muted-foreground">{t('dashboardNoSession')}</p>}

      {accessToken && !isOwner && (
        <Alert>
          <AlertDescription>{t('agentsPageForbidden')}</AlertDescription>
        </Alert>
      )}

      {accessToken && isOwner && mcpUnavailable ? (
        <EmptyState
          icon={Bot}
          title={t('agentsMcpUnavailableTitle')}
          description={MCP_API_UNAVAILABLE}
        />
      ) : null}

      {accessToken && companyId != null && isOwner && !mcpUnavailable ? (
        <>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {error instanceof Error ? error.message : t('agentsLoadError')}
              </AlertDescription>
            </Alert>
          ) : null}

          {typeof retentionDays === 'number' ? (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-snug text-amber-900"
            >
              {t('agentsRetentionBanner', { data_retention_days: retentionDays })}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Input
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              placeholder={t('agentsSearchPlaceholder')}
              className="h-9 min-w-[220px] max-w-xs"
              aria-label={t('agentsSearchPlaceholder')}
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as AgentStatusFilter)}
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('agentsFilterAllStatuses')}</SelectItem>
                <SelectItem value="active">{t('agentsFilterActive')}</SelectItem>
                {hasPausedAgents ? (
                  <SelectItem value="paused">{t('agentsFilterPaused')}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
            <Select
              value={creatorFilter}
              onValueChange={setCreatorFilter}
            >
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CREATOR_ANY}>{t('agentsFilterAnyCreator')}</SelectItem>
                {creatorOptions.map((name) => (
                  <SelectItem
                    key={name}
                    value={name}
                  >
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {approvals.length > 0 ? (
            <div className="space-y-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
              <h2 className="text-sm font-semibold">{t('agentsApprovalsTitle')}</h2>
              <ul className="divide-y divide-border">
                {approvals.map((approval) => {
                  const busy = busyApprovalId === approval.id;
                  const destructive = isDestructiveMcpApproval(approval);
                  const argsJson = formatApprovalArgumentsForConfirm(approval);
                  const hasRedactedArgs = mcpApprovalHasRedactedArguments(approval);
                  return (
                    <li
                      key={approval.id}
                      className={cn(
                        'space-y-3 py-3 first:pt-0 last:pb-0',
                        destructive && 'bg-destructive/5',
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {approval.service}.{approval.action}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t('agentsApprovalMeta', {
                              agent: approval.agent_name,
                              target: approval.target || approval.service,
                            })}
                          </p>
                          {destructive ? (
                            <p className="text-sm font-medium text-destructive">
                              {t('agentsDestructiveApprovalWarning')}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-sm tabular-nums text-muted-foreground">
                          {t('agentsApprovalExpires', {
                            countdown: formatCountdown(approval.expires_at, nowMs),
                          })}
                        </p>
                      </div>
                      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
                        {argsJson}
                      </pre>
                      {!hasRedactedArgs ? (
                        <p className="text-sm text-destructive">{t('agentsApprovalArgsMissing')}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={destructive ? 'destructive' : 'default'}
                          disabled={busy || !hasRedactedArgs}
                          onClick={() => void onResolveApproval(approval, 'approve')}
                        >
                          {busy ? (
                            <Loader2
                              className="mr-1.5 size-4 animate-spin"
                              aria-hidden
                            />
                          ) : null}
                          {t('agentsApprove')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void onResolveApproval(approval, 'reject')}
                        >
                          {t('agentsReject')}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('agentsSectionActive')}
            </p>
            {loading && agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('agentsCallLogLoading')}</p>
            ) : filteredActiveAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {listHasFilters ? t('agentsNoMatch') : t('agentsNoActive')}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredActiveAgents.map((agent) => (
                  <AgentAccordionRow
                    key={agent.id}
                    agent={agent}
                    expanded={expandedAgentId === agent.id}
                    onToggle={() => toggleAgentExpand(agent.id)}
                    accessToken={accessToken}
                    companyId={companyId}
                    logsRefreshKey={logsRefreshKey}
                    locale={locale}
                    readOnly={false}
                    busy={busyAgentId === agent.id}
                    onRevoke={() => void onRevoke(agent)}
                    personal={personalIds.has(agent.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {revokedAgents.length > 0 ? (
            <div>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8a6300] hover:underline"
                onClick={() => setShowRevoked((v) => !v)}
              >
                {showRevoked
                  ? t('agentsHideRevoked')
                  : t('agentsShowRevoked', { count: revokedAgents.length })}
                <ChevronRight
                  className={cn(
                    'size-4 transition-transform motion-reduce:transition-none',
                    showRevoked && 'rotate-90',
                  )}
                  aria-hidden
                />
              </button>
              {showRevoked ? (
                <div className="mt-3 space-y-2">
                  {revokedAgents.map((agent) => (
                    <AgentAccordionRow
                      key={agent.id}
                      agent={agent}
                      expanded={expandedAgentId === agent.id}
                      onToggle={() => toggleAgentExpand(agent.id)}
                      accessToken={accessToken}
                      companyId={companyId}
                      logsRefreshKey={logsRefreshKey}
                      locale={locale}
                      readOnly
                      busy={false}
                      onRevoke={() => {}}
                      personal={personalIds.has(agent.id)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
