import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  ChevronRight,
  Copy,
  ExternalLink,
  HelpCircle,
  Loader2,
  Pause,
  ShieldAlert,
} from 'lucide-react';
import shellui from '@shellui/sdk';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTableCard, SkeletonRows } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { SettingsSection } from '@/components/admin/SettingsSection';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { getCompanyIdFromJwt, getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import {
  agentDisplayStatus,
  approveCompanyMcpApproval,
  fetchCompanyMcpAgents,
  fetchCompanyMcpApprovals,
  fetchCompanyMcpCallLogs,
  fetchMcpDiscoveredServices,
  formatApprovalArgumentsForConfirm,
  formatCallLogArguments,
  isDestructiveMcpApproval,
  isMcpApiUnavailable,
  mcpApprovalHasRedactedArguments,
  MCP_API_UNAVAILABLE,
  pauseCompanyMcpAgent,
  rejectCompanyMcpApproval,
  revokeCompanyMcpAgent,
  type CompanyMcpAgent,
  type CompanyMcpApproval,
  type CompanyMcpCallLogEntry,
  type McpDiscoveredService,
} from '@/lib/companyAgentsApi';
import {
  aiServiceMcpEndpointUrl,
  IDENTITY_MCP_AGENTS_DOCS_URL,
  mcpClientCopySnippet,
  type McpClientId,
} from '@/lib/companyAgentsMcpConfig';
import { useShelluiAiService } from '@/hooks/useShelluiAiService';
import { cn } from '@/lib/utils';

function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function formatCountdown(expiresAt: string, nowMs: number): string {
  const ms = new Date(expiresAt).getTime() - nowMs;
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function servicesLabel(services: string[], t: (k: string) => string): string {
  if (services.length === 0) return '-';
  return services.map((id) => t(`agentsService_${id}`)).join(', ');
}

const MCP_CLIENT_TABS: McpClientId[] = ['claude', 'cursor', 'chatgpt', 'other'];

function mcpClientStepKeys(client: McpClientId): string[] {
  switch (client) {
    case 'claude':
      return [
        'agentsClientClaudeStep1',
        'agentsClientClaudeStep2',
        'agentsClientClaudeStep3',
        'agentsClientClaudeStep4',
      ];
    case 'cursor':
      return [
        'agentsClientCursorStep1',
        'agentsClientCursorStep2',
        'agentsClientCursorStep3',
        'agentsClientCursorStep4',
      ];
    case 'chatgpt':
      return [
        'agentsClientChatgptStep1',
        'agentsClientChatgptStep2',
        'agentsClientChatgptStep3',
        'agentsClientChatgptStep4',
      ];
    case 'other':
      return ['agentsClientOtherStep1', 'agentsClientOtherStep2', 'agentsClientOtherStep3'];
  }
}

function TableHeadWithTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <TableHead>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help items-center gap-1">
            {label}
            <HelpCircle
              className="size-3.5 text-muted-foreground"
              aria-hidden
            />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TableHead>
  );
}

function lastCallForAgent(agentId: string, logs: CompanyMcpCallLogEntry[]): string | null {
  let latest: string | null = null;
  for (const row of logs) {
    if (row.agent_id !== agentId) continue;
    if (!latest || row.created_at > latest) latest = row.created_at;
  }
  return latest;
}

export function AgentsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const accessToken = useShelluiAccessToken();
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));

  const [discoveredServices, setDiscoveredServices] = useState<McpDiscoveredService[]>([]);
  const [agents, setAgents] = useState<CompanyMcpAgent[]>([]);
  const [approvals, setApprovals] = useState<CompanyMcpApproval[]>([]);
  const [callLogs, setCallLogs] = useState<CompanyMcpCallLogEntry[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [mcpUnavailable, setMcpUnavailable] = useState(false);
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);
  const [connectClient, setConnectClient] = useState<McpClientId>('cursor');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const aiService = useShelluiAiService();
  const mcpOrigin = aiService?.url ?? '';

  const mcpEndpoint = useMemo(
    () => (mcpOrigin ? aiServiceMcpEndpointUrl(mcpOrigin, companyId) : ''),
    [mcpOrigin, companyId],
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
      const [agentRows, approvalRows, logRows, serviceRows] = await Promise.all([
        fetchCompanyMcpAgents(accessToken, companyId),
        fetchCompanyMcpApprovals(accessToken, companyId),
        fetchCompanyMcpCallLogs(accessToken, companyId),
        fetchMcpDiscoveredServices(accessToken, companyId),
      ]);
      setAgents(agentRows);
      setApprovals(approvalRows);
      setCallLogs(logRows);
      setDiscoveredServices(serviceRows);
      const first = agentRows.find((a) => agentDisplayStatus(a) !== 'revoked')?.id ?? null;
      setSelectedAgentId((prev) => (prev && agentRows.some((a) => a.id === prev) ? prev : first));
    } catch (e) {
      if (isMcpApiUnavailable(e)) {
        setMcpUnavailable(true);
        setAgents([]);
        setApprovals([]);
        setCallLogs([]);
        setDiscoveredServices([]);
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

  const filteredCallLog = useMemo(
    () => (selectedAgentId ? callLogs.filter((row) => row.agent_id === selectedAgentId) : []),
    [callLogs, selectedAgentId],
  );

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

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

  async function onPause(agent: CompanyMcpAgent) {
    if (!accessToken || companyId == null) return;
    setBusyAgentId(agent.id);
    try {
      const updated = await pauseCompanyMcpAgent(accessToken, companyId, agent.id);
      setAgents((rows) => rows.map((a) => (a.id === updated.id ? updated : a)));
    } catch (e) {
      shellui.toast({
        type: 'error',
        title: e instanceof Error ? e.message : t('agentsSaveError'),
      });
    } finally {
      setBusyAgentId(null);
    }
  }

  async function onRevoke(agent: CompanyMcpAgent) {
    if (!accessToken || companyId == null) return;
    const ok = await askShelluiConfirm({
      title: t('agentsRevokeConfirmTitle', { name: agent.name }),
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
    } catch (e) {
      shellui.toast({
        type: 'error',
        title: e instanceof Error ? e.message : t('agentsSaveError'),
      });
    } finally {
      setBusyAgentId(null);
    }
  }

  return (
    <div className="w-full space-y-8">
      <PageHeader
        title={t('agentsPageTitle')}
        service={t('dashboardEnvBadge')}
        description={t('agentsPageDescription')}
      />

      {accessToken && isOwner && !mcpUnavailable ? (
        <div className="space-y-4 rounded-xl border border-border bg-card px-5 py-4 text-card-foreground shadow-xs">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t('agentsPageIntroMcp')}</p>
            <p>{t('agentsPageIntroAgents')}</p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t('agentsPageIntroSafety1')}</li>
            <li>{t('agentsPageIntroSafety2')}</li>
            <li>{t('agentsPageIntroSafety3')}</li>
          </ul>
          <a
            href={IDENTITY_MCP_AGENTS_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-ink underline-offset-4 hover:underline"
          >
            <ExternalLink
              className="size-3.5 shrink-0"
              aria-hidden
            />
            {t('agentsDocsLink')}
          </a>
        </div>
      ) : null}

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

          <SettingsSection
            id="agents-mcp"
            title={t('agentsMcpTitle')}
            description={t('agentsMcpDescription')}
            busy={loading}
          >
            <div className="space-y-6 p-5">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">{t('agentsConnectTitle')}</p>
                {!mcpOrigin ? (
                  <p className="text-sm text-muted-foreground">{t('agentsConnectMissingUrl')}</p>
                ) : (
                  <div className="space-y-3">
                    <div
                      className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
                      role="tablist"
                      aria-label={t('agentsConnectTitle')}
                    >
                      {MCP_CLIENT_TABS.map((client) => (
                        <Button
                          key={client}
                          type="button"
                          role="tab"
                          aria-selected={connectClient === client}
                          variant={connectClient === client ? 'secondary' : 'ghost'}
                          size="sm"
                          className="text-xs sm:text-sm"
                          onClick={() => setConnectClient(client)}
                        >
                          {t(`agentsClientTab_${client}`)}
                        </Button>
                      ))}
                    </div>
                    <div
                      role="tabpanel"
                      className="space-y-3"
                    >
                      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                        {mcpClientStepKeys(connectClient).map((key) => (
                          <li key={key}>{t(key)}</li>
                        ))}
                      </ol>
                      <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs text-foreground">
                        {mcpClientCopySnippet(connectClient, mcpOrigin, companyId)}
                      </pre>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void copyText(
                            t(`agentsCopyClient_${connectClient}`),
                            mcpClientCopySnippet(connectClient, mcpOrigin, companyId),
                          )
                        }
                      >
                        <Copy
                          className="mr-1.5 size-3.5"
                          aria-hidden
                        />
                        {t(`agentsCopyClient_${connectClient}`)}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {discoveredServices.length > 0 ? (
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-sm font-medium text-foreground">{t('agentsServicesLabel')}</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {discoveredServices.map((svc) => (
                      <li
                        key={svc.id}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1"
                      >
                        <span className="font-medium text-foreground">
                          {t(`agentsService_${svc.id}`, { defaultValue: svc.name })}
                        </span>
                        <span className="font-mono text-xs">{svc.mcp_url}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => void copyText(t('agentsCopyServiceUrl'), svc.mcp_url)}
                        >
                          <Copy
                            className="mr-1 size-3"
                            aria-hidden
                          />
                          {t('agentsCopyServiceUrl')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </SettingsSection>

          <Tabs
            defaultValue="agents"
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="agents">{t('agentsTabAgents')}</TabsTrigger>
              <TabsTrigger value="approvals">
                {t('agentsTabApprovals')}
                {approvals.length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {approvals.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="agents">
              <DataTableCard
                label={t('agentsListTitle')}
                busy={loading}
                toolbar={<h2 className="text-sm font-semibold">{t('agentsListTitle')}</h2>}
              >
                {loading && agents.length === 0 ? (
                  <Table>
                    <TableBody>
                      <SkeletonRows
                        rows={3}
                        columns={['', '', '', '', '', '', '', '']}
                      />
                    </TableBody>
                  </Table>
                ) : agents.length === 0 ? (
                  <EmptyState
                    icon={Bot}
                    title={t('agentsListEmpty')}
                    description={
                      <ol className="mx-auto max-w-md list-decimal space-y-1.5 pl-5 text-left text-[13px]">
                        <li>{t('agentsListEmptyStep1')}</li>
                        <li>{t('agentsListEmptyStep2')}</li>
                        <li>{t('agentsListEmptyStep3')}</li>
                      </ol>
                    }
                    actions={
                      mcpEndpoint ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void copyText(t('agentsCopyServiceUrl'), mcpEndpoint)}
                        >
                          <Copy
                            className="mr-1.5 size-3.5"
                            aria-hidden
                          />
                          {t('agentsCopyServiceUrl')}
                        </Button>
                      ) : null
                    }
                  />
                ) : (
                  <>
                    <details className="group mx-5 mb-4 rounded-lg border border-border">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none group-open:rotate-90"
                          aria-hidden
                        />
                        {t('agentsAccessLegendTitle')}
                      </summary>
                      <div className="space-y-2 border-t border-border px-3 py-3 text-sm text-muted-foreground">
                        <p>{t('agentsAccessLegendIntro')}</p>
                        <ul className="list-disc space-y-1 pl-5">
                          <li>
                            <span className="font-medium text-foreground">
                              {t('agentsAccess_read_only')}
                            </span>
                            {' · '}
                            {t('agentsAccessLegend_read_only')}
                          </li>
                          <li>
                            <span className="font-medium text-foreground">
                              {t('agentsAccess_ask')}
                            </span>
                            {' · '}
                            {t('agentsAccessLegend_ask')}
                          </li>
                          <li>
                            <span className="font-medium text-foreground">
                              {t('agentsAccess_full')}
                            </span>
                            {' · '}
                            {t('agentsAccessLegend_full')}
                          </li>
                          <li>
                            <span className="font-medium text-foreground">
                              {t('agentsColDestructive')}
                            </span>
                            {' · '}
                            {t('agentsAccessLegend_destructive')}
                          </li>
                        </ul>
                      </div>
                    </details>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('agentsColName')}</TableHead>
                          <TableHead>{t('agentsColProjectScope')}</TableHead>
                          <TableHeadWithTooltip
                            label={t('agentsColAccess')}
                            tooltip={t('agentsColAccessTooltip')}
                          />
                          <TableHead>{t('agentsColReadLevel')}</TableHead>
                          <TableHead>{t('agentsColServices')}</TableHead>
                          <TableHeadWithTooltip
                            label={t('agentsColDestructive')}
                            tooltip={t('agentsColDestructiveTooltip')}
                          />
                          <TableHead>{t('agentsColExpiry')}</TableHead>
                          <TableHead>{t('agentsColLastCall')}</TableHead>
                          <TableHead>{t('agentsColStatus')}</TableHead>
                          <TableHead className="text-right">{t('agentsColActions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agents.map((agent) => {
                          const busy = busyAgentId === agent.id;
                          const status = agentDisplayStatus(agent);
                          const selected = selectedAgentId === agent.id;
                          return (
                            <TableRow
                              key={agent.id}
                              className={cn(selected && 'bg-muted/40')}
                              onClick={() => setSelectedAgentId(agent.id)}
                            >
                              <TableCell className="font-medium">{agent.name}</TableCell>
                              <TableCell>{agent.project_scope || '-'}</TableCell>
                              <TableCell>{t(`agentsAccess_${agent.access_mode}`)}</TableCell>
                              <TableCell>{t(`agentsReadLevel_${agent.read_level}`)}</TableCell>
                              <TableCell className="max-w-[140px] truncate">
                                {servicesLabel(agent.services_allowed, t)}
                              </TableCell>
                              <TableCell>
                                {agent.allow_destructive_without_asking
                                  ? t('agentsDestructiveAllowed')
                                  : t('agentsDestructiveAsk')}
                              </TableCell>
                              <TableCell>{formatDateTime(agent.expires_at, locale)}</TableCell>
                              <TableCell>
                                {formatDateTime(lastCallForAgent(agent.id, callLogs), locale)}
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  tone={
                                    status === 'active'
                                      ? 'success'
                                      : status === 'paused'
                                        ? 'warning'
                                        : 'muted'
                                  }
                                >
                                  {t(`agentsStatus_${status}`)}
                                </StatusBadge>
                              </TableCell>
                              <TableCell
                                className="text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy || status !== 'active'}
                                    onClick={() => void onPause(agent)}
                                  >
                                    {busy ? (
                                      <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden
                                      />
                                    ) : (
                                      <Pause
                                        className="size-4"
                                        aria-hidden
                                      />
                                    )}
                                    <span className="sr-only">{t('agentsPause')}</span>
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy || status === 'revoked'}
                                    onClick={() => void onRevoke(agent)}
                                  >
                                    {t('agentsRevoke')}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </>
                )}
              </DataTableCard>

              {selectedAgent?.access_mode === 'full' ? (
                <Alert
                  variant="destructive"
                  className="mt-4"
                >
                  <ShieldAlert
                    className="size-4"
                    aria-hidden
                  />
                  <AlertTitle>{t('agentsFullAccessWarningTitle')}</AlertTitle>
                  <AlertDescription>
                    {t('agentsFullAccessWarningDescription', { name: selectedAgent.name })}
                  </AlertDescription>
                </Alert>
              ) : null}

              {selectedAgent?.allow_destructive_without_asking ? (
                <Alert
                  variant="destructive"
                  className="mt-4"
                >
                  <ShieldAlert
                    className="size-4"
                    aria-hidden
                  />
                  <AlertTitle>{t('agentsDestructiveWarningTitle')}</AlertTitle>
                  <AlertDescription>
                    {t('agentsDestructiveWarningDescription', { name: selectedAgent.name })}
                  </AlertDescription>
                </Alert>
              ) : null}

              {selectedAgent ? (
                <DataTableCard
                  label={t('agentsCallLogTitle', { name: selectedAgent.name })}
                  className="mt-4"
                  toolbar={
                    <h2 className="text-sm font-semibold">
                      {t('agentsCallLogTitle', { name: selectedAgent.name })}
                    </h2>
                  }
                >
                  {filteredCallLog.length === 0 ? (
                    <p className="px-5 pb-4 text-sm text-muted-foreground">
                      {t('agentsCallLogEmpty')}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('agentsCallColTime')}</TableHead>
                          <TableHead>{t('agentsCallColTool')}</TableHead>
                          <TableHead>{t('agentsCallColTarget')}</TableHead>
                          <TableHead>{t('agentsCallColStatus')}</TableHead>
                          <TableHead className="text-right">{t('agentsCallColDuration')}</TableHead>
                          <TableHead>{t('agentsCallColArguments')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCallLog.map((entry) => {
                          const argsText = formatCallLogArguments(entry.arguments);
                          return (
                            <TableRow key={entry.id}>
                              <TableCell>{formatDateTime(entry.created_at, locale)}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {entry.tool || `${entry.method} ${entry.path}`.trim()}
                              </TableCell>
                              <TableCell>{entry.service}</TableCell>
                              <TableCell>{entry.status_code || '-'}</TableCell>
                              <TableCell className="text-right">{entry.duration_ms} ms</TableCell>
                              <TableCell className="max-w-[240px] align-top">
                                {argsText ? (
                                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
                                    {argsText}
                                  </pre>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </DataTableCard>
              ) : null}
            </TabsContent>

            <TabsContent value="approvals">
              <DataTableCard
                label={t('agentsApprovalsTitle')}
                busy={loading}
                toolbar={<h2 className="text-sm font-semibold">{t('agentsApprovalsTitle')}</h2>}
              >
                {loading && approvals.length === 0 ? (
                  <div className="px-5 py-4">
                    <SkeletonRows
                      rows={2}
                      columns={['']}
                    />
                  </div>
                ) : approvals.length === 0 ? (
                  <EmptyState
                    icon={Bot}
                    title={t('agentsApprovalsEmpty')}
                    description={t('agentsApprovalsEmptyHint')}
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {approvals.map((approval) => {
                      const busy = busyApprovalId === approval.id;
                      const destructive = isDestructiveMcpApproval(approval);
                      const argsJson = formatApprovalArgumentsForConfirm(approval);
                      const hasRedactedArgs = mcpApprovalHasRedactedArguments(approval);
                      return (
                        <li
                          key={approval.id}
                          className={cn('space-y-3 px-5 py-4', destructive && 'bg-destructive/5')}
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
                            <p className="text-sm text-destructive">
                              {t('agentsApprovalArgsMissing')}
                            </p>
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
                )}
              </DataTableCard>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
