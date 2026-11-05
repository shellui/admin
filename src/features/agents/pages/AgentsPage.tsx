import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, ChevronRight, Copy, Loader2 } from 'lucide-react';
import shellui from '@shellui/sdk';
import { PageHeader } from '@/components/admin/PageHeader';
import { EmptyState } from '@/components/admin/EmptyState';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  mcpApprovalHasRedactedArguments,
  mcpCallLogOutcome,
  MCP_API_UNAVAILABLE,
  rejectCompanyMcpApproval,
  revokeCompanyMcpAgent,
  type CompanyMcpAgent,
  type CompanyMcpApproval,
  type CompanyMcpCallLogEntry,
  type McpCallLogOutcome,
} from '@/lib/companyAgentsApi';
import {
  buildAgentPrompt,
  buildCompanyMcpUrl,
  defaultPersonalAgentExpiresAt,
  formatDefaultAgentName,
  getDefaultPersonalAgentServices,
  isGlobalIdentitySession,
} from '@/lib/mcpAgentsConnect';
import { createMcpPersonalAgent, fetchMcpPersonalStatus } from '@/lib/personalAgentsApi';
import type { McpPersonalStatus } from '@/lib/personalAgentsApi';
import { formatDurationMs } from '@/lib/scheduledJobsApi';
import { useShelluiAiService } from '@/hooks/useShelluiAiService';
import { cn } from '@/lib/utils';

type IssuedMcpConnection = {
  accessToken: string;
  mcpUrl: string;
  prompt: string;
};

type AgentStatusFilter = 'all' | 'active' | 'paused';
type CallLogStatusFilter = 'any' | McpCallLogOutcome;
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

function countCallsForAgent(agent: CompanyMcpAgent, logs: CompanyMcpCallLogEntry[]): number {
  if (typeof agent.call_count === 'number' && Number.isFinite(agent.call_count)) {
    return agent.call_count;
  }
  return logs.filter((row) => row.agent_id === agent.id).length;
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
  statusFilter: CallLogStatusFilter,
  timeFilter: CallLogTimeFilter,
  nowMs: number,
): CompanyMcpCallLogEntry[] {
  let out = rows;
  const q = search.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (row) =>
        row.service.toLowerCase().includes(q) ||
        row.tool.toLowerCase().includes(q) ||
        `${row.method} ${row.path}`.toLowerCase().includes(q),
    );
  }
  if (statusFilter !== 'any') {
    out = out.filter((row) => mcpCallLogOutcome(row) === statusFilter);
  }
  if (timeFilter !== 'all') {
    const days = timeFilter === '7d' ? 7 : 30;
    const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
    out = out.filter((row) => new Date(row.created_at).getTime() >= cutoff);
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function AgentCallLogPanel({
  agentId,
  callLogs,
  loading,
  locale,
}: {
  agentId: string;
  callLogs: CompanyMcpCallLogEntry[];
  loading: boolean;
  locale: string;
}) {
  const { t } = useTranslation();
  const [logSearch, setLogSearch] = useState('');
  const [logStatus, setLogStatus] = useState<CallLogStatusFilter>('any');
  const [logTime, setLogTime] = useState<CallLogTimeFilter>('7d');
  const [nowMs] = useState(() => Date.now());

  const rows = useMemo(
    () =>
      filterCallLogRows(
        callLogs.filter((row) => row.agent_id === agentId),
        logSearch,
        logStatus,
        logTime,
        nowMs,
      ),
    [agentId, callLogs, logSearch, logStatus, logTime, nowMs],
  );

  const statusLabel = (outcome: McpCallLogOutcome) => {
    if (outcome === 'succeeded') return t('agentsLogStatusSucceeded');
    if (outcome === 'denied') return t('agentsLogStatusDenied');
    return t('agentsLogStatusFailed');
  };

  return (
    <div className="border-t border-border bg-muted/30 px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('agentsCallLog')}
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          value={logSearch}
          onChange={(e) => setLogSearch(e.target.value)}
          placeholder={t('agentsSearchToolsPlaceholder')}
          className="h-9 min-w-[200px] max-w-xs text-sm"
          aria-label={t('agentsSearchToolsPlaceholder')}
        />
        <Select
          value={logStatus}
          onValueChange={(v) => setLogStatus(v as CallLogStatusFilter)}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t('agentsLogFilterAnyStatus')}</SelectItem>
            <SelectItem value="succeeded">{t('agentsLogStatusSucceeded')}</SelectItem>
            <SelectItem value="failed">{t('agentsLogStatusFailed')}</SelectItem>
            <SelectItem value="denied">{t('agentsLogStatusDenied')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={logTime}
          onValueChange={(v) => setLogTime(v as CallLogTimeFilter)}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">{t('agentsLogTimeLast7')}</SelectItem>
            <SelectItem value="30d">{t('agentsLogTimeLast30')}</SelectItem>
            <SelectItem value="all">{t('agentsLogTimeAll')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('agentsCallLogLoading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('agentsCallLogEmptyRange')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('agentsCallColWhen')}</TableHead>
                <TableHead>{t('agentsCallColService')}</TableHead>
                <TableHead>{t('agentsCallColTool')}</TableHead>
                <TableHead>{t('agentsCallColStatus')}</TableHead>
                <TableHead>{t('agentsCallColDuration')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((entry) => {
                const outcome = mcpCallLogOutcome(entry);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">
                      {formatCallWhen(entry.created_at, locale)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.service}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {entry.tool || `${entry.method} ${entry.path}`.trim() || '-'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'font-semibold',
                        outcome === 'succeeded' && 'text-emerald-700',
                        outcome === 'denied' && 'text-destructive',
                        outcome === 'failed' && 'text-destructive',
                      )}
                    >
                      {statusLabel(outcome)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatDurationMs(entry.duration_ms, locale) ?? '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function AgentAccordionRow({
  agent,
  expanded,
  onToggle,
  callLogs,
  loadingLogs,
  locale,
  readOnly,
  busy,
  onRevoke,
}: {
  agent: CompanyMcpAgent;
  expanded: boolean;
  onToggle: () => void;
  callLogs: CompanyMcpCallLogEntry[];
  loadingLogs: boolean;
  locale: string;
  readOnly: boolean;
  busy: boolean;
  onRevoke: () => void;
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
  const callCount = countCallsForAgent(agent, callLogs);

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
        </button>
        <StatusBadge tone={statusTone}>{t(`agentsStatus_${status}`)}</StatusBadge>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {agent.expires_at
            ? t('agentsExpires', { date: formatDateOnly(agent.expires_at, locale) })
            : '-'}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {t('agentsCallCount', { count: callCount })}
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
        <AgentCallLogPanel
          agentId={agent.id}
          callLogs={callLogs}
          loading={loadingLogs}
          locale={locale}
        />
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
  const [callLogs, setCallLogs] = useState<CompanyMcpCallLogEntry[]>([]);
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
  const [personalStatus, setPersonalStatus] = useState<McpPersonalStatus | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectName, setConnectName] = useState('');
  const [creatingConnection, setCreatingConnection] = useState(false);
  const [createConnectionError, setCreateConnectionError] = useState<string | null>(null);
  const [issuedConnection, setIssuedConnection] = useState<IssuedMcpConnection | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const aiService = useShelluiAiService();
  const mcpOrigin = aiService?.url ?? '';

  const includeSaas = isGlobalIdentitySession(personalStatus);
  const companyMcpUrl = useMemo(
    () => buildCompanyMcpUrl(mcpOrigin, companyId, personalStatus?.mcp_url),
    [mcpOrigin, companyId, personalStatus?.mcp_url],
  );

  const load = useCallback(async () => {
    if (!accessToken || companyId == null || !isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setMcpUnavailable(false);
    try {
      const [agentRows, approvalRows, logRows, statusRow] = await Promise.all([
        fetchCompanyMcpAgents(accessToken, companyId),
        fetchCompanyMcpApprovals(accessToken, companyId),
        fetchCompanyMcpCallLogs(accessToken, companyId),
        fetchMcpPersonalStatus(accessToken, companyId).catch(() => null),
      ]);
      setAgents(agentRows);
      setApprovals(approvalRows);
      setCallLogs(logRows);
      setPersonalStatus(statusRow);
    } catch (e) {
      if (isMcpApiUnavailable(e)) {
        setMcpUnavailable(true);
        setAgents([]);
        setApprovals([]);
        setCallLogs([]);
        setError(null);
      } else {
        setError(e);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, isOwner]);

  useEffect(() => {
    void load();
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

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      shellui.toast({ type: 'success', title: t('agentsCopied', { label }) });
    } catch {
      shellui.toast({ type: 'error', title: t('agentsCopyError') });
    }
  }

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

  async function onCreateConnection() {
    if (!accessToken || companyId == null || !companyMcpUrl) return;
    const trimmed = connectName.trim();
    const name = trimmed || formatDefaultAgentName(locale);
    setCreatingConnection(true);
    setCreateConnectionError(null);
    try {
      const result = await createMcpPersonalAgent(
        accessToken,
        companyId,
        {
          name,
          services: getDefaultPersonalAgentServices(includeSaas),
          access_mode: 'ask',
          read_level: 'safe',
          allow_destructive: false,
          expires_at: defaultPersonalAgentExpiresAt(),
        },
        { allowSaas: includeSaas },
      );
      const promptMcpUrl =
        buildCompanyMcpUrl(mcpOrigin, companyId, result.resource) || companyMcpUrl;
      const prompt = buildAgentPrompt(promptMcpUrl, result.access_token);
      setIssuedConnection({
        accessToken: result.access_token,
        mcpUrl: promptMcpUrl,
        prompt,
      });
      setConnectName('');
      const agentRows = await fetchCompanyMcpAgents(accessToken, companyId);
      setAgents(agentRows);
    } catch (e) {
      setCreateConnectionError(e instanceof Error ? e.message : t('agentsConnectCreateError'));
    } finally {
      setCreatingConnection(false);
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
      const updated = await revokeCompanyMcpAgent(accessToken, companyId, agent.id);
      setAgents((rows) => rows.map((a) => (a.id === updated.id ? updated : a)));
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
              onClick={() => setConnectOpen(true)}
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

      {accessToken && isOwner && !mcpUnavailable ? (
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
                    callLogs={callLogs}
                    loadingLogs={loading}
                    locale={locale}
                    readOnly={false}
                    busy={busyAgentId === agent.id}
                    onRevoke={() => void onRevoke(agent)}
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
                      callLogs={callLogs}
                      loadingLogs={loading}
                      locale={locale}
                      readOnly
                      busy={false}
                      onRevoke={() => {}}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      <Sheet
        open={connectOpen}
        onOpenChange={setConnectOpen}
      >
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('agentsConnectOpen')}</SheetTitle>
            <SheetDescription>{t('agentsConnectIntro')}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {!mcpOrigin || !companyMcpUrl ? (
              <p className="text-sm text-muted-foreground">{t('agentsConnectMissingUrl')}</p>
            ) : issuedConnection ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {t('agentsConnectCreatedTitle')}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('agentsConnectCreatedHint')}</p>
                </div>
                <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs text-foreground">
                  {issuedConnection.prompt}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => void copyText(t('agentsCopyPrompt'), issuedConnection.prompt)}
                  >
                    <Copy
                      className="mr-1.5 size-3.5"
                      aria-hidden
                    />
                    {t('agentsCopyPrompt')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void copyText(t('agentsCopyToken'), issuedConnection.accessToken)
                    }
                  >
                    <Copy
                      className="mr-1.5 size-3.5"
                      aria-hidden
                    />
                    {t('agentsCopyToken')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIssuedConnection(null)}
                  >
                    {t('agentsConnectCreateAnother')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label
                  htmlFor="agents-connect-name"
                  className="text-sm font-medium text-foreground"
                >
                  {t('agentsConnectNameLabel')}
                </label>
                <Input
                  id="agents-connect-name"
                  value={connectName}
                  onChange={(e) => setConnectName(e.target.value)}
                  placeholder={formatDefaultAgentName(locale)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">{t('agentsConnectNameHint')}</p>
                {createConnectionError ? (
                  <p className="text-sm text-destructive">{createConnectionError}</p>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={creatingConnection}
                  onClick={() => void onCreateConnection()}
                >
                  {creatingConnection ? (
                    <>
                      <Loader2
                        className="mr-1.5 size-3.5 animate-spin"
                        aria-hidden
                      />
                      {t('agentsConnectCreating')}
                    </>
                  ) : (
                    t('agentsConnectCreateButton')
                  )}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
