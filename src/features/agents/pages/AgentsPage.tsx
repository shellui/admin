import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Copy, Loader2, Pause, ShieldAlert } from 'lucide-react';
import shellui from '@shellui/sdk';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTableCard, SkeletonRows } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { SettingsSection } from '@/components/admin/SettingsSection';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  companyAgentsUsingMock,
  fetchCompanyMcpAgents,
  fetchCompanyMcpApprovals,
  fetchCompanyMcpCallLog,
  fetchCompanyMcpSettings,
  MCP_SERVICE_IDS,
  patchCompanyMcpAgent,
  patchCompanyMcpSettings,
  pauseCompanyMcpAgent,
  resolveCompanyMcpApproval,
  revokeCompanyMcpAgent,
  type CompanyMcpAgent,
  type CompanyMcpApproval,
  type CompanyMcpCallLogEntry,
  type CompanyMcpSettings,
  type McpServiceId,
} from '@/lib/companyAgentsApi';
import {
  claudeDesktopMcpConfig,
  cursorMcpConfig,
  genericMcpJsonConfig,
  mcpConnectPrompt,
} from '@/lib/companyAgentsMcpConfig';
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

function servicesLabel(services: McpServiceId[], t: (k: string) => string): string {
  if (services.length === 0) return '-';
  return services.map((id) => t(`agentsService_${id}`)).join(', ');
}

export function AgentsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const accessToken = useShelluiAccessToken();
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));

  const [settings, setSettings] = useState<CompanyMcpSettings | null>(null);
  const [agents, setAgents] = useState<CompanyMcpAgent[]>([]);
  const [approvals, setApprovals] = useState<CompanyMcpApproval[]>([]);
  const [callLog, setCallLog] = useState<CompanyMcpCallLogEntry[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [usingMock, setUsingMock] = useState(false);

  const mcpUrl = settings?.mcp_url ?? '';

  const load = useCallback(async () => {
    if (!accessToken || companyId == null || !isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [cfg, agentRows, approvalRows] = await Promise.all([
        fetchCompanyMcpSettings(accessToken, companyId),
        fetchCompanyMcpAgents(accessToken, companyId),
        fetchCompanyMcpApprovals(accessToken, companyId),
      ]);
      setSettings(cfg);
      setAgents(agentRows);
      setApprovals(approvalRows);
      setUsingMock(companyAgentsUsingMock());
      const firstActive = agentRows.find((a) => a.status !== 'revoked')?.id ?? null;
      setSelectedAgentId((prev) =>
        prev && agentRows.some((a) => a.id === prev) ? prev : firstActive,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t('agentsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, isOwner, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const loadCallLog = useCallback(
    async (agentId: string) => {
      if (!accessToken || companyId == null) return;
      try {
        const rows = await fetchCompanyMcpCallLog(accessToken, companyId, agentId);
        setCallLog(rows);
        setUsingMock(companyAgentsUsingMock());
      } catch (e) {
        setCallLog([]);
        shellui.toast({
          type: 'error',
          title: e instanceof Error ? e.message : t('agentsLoadError'),
        });
      }
    },
    [accessToken, companyId, t],
  );

  useEffect(() => {
    if (selectedAgentId) void loadCallLog(selectedAgentId);
    else setCallLog([]);
  }, [selectedAgentId, loadCallLog]);

  const connectLine = useMemo(() => (mcpUrl ? mcpConnectPrompt(mcpUrl) : ''), [mcpUrl]);

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      shellui.toast({ type: 'success', title: t('agentsCopied', { label }) });
    } catch {
      shellui.toast({ type: 'error', title: t('agentsCopyError') });
    }
  }

  async function onToggleEnabled(checked: boolean) {
    if (!accessToken || companyId == null || !settings) return;
    setSavingSettings(true);
    try {
      const next = await patchCompanyMcpSettings(accessToken, companyId, { enabled: checked });
      setSettings(next);
      setUsingMock(companyAgentsUsingMock());
    } catch (e) {
      shellui.toast({
        type: 'error',
        title: e instanceof Error ? e.message : t('agentsSaveError'),
      });
    } finally {
      setSavingSettings(false);
    }
  }

  async function onToggleService(serviceId: McpServiceId, checked: boolean) {
    if (!accessToken || companyId == null || !settings) return;
    setSavingSettings(true);
    try {
      const next = await patchCompanyMcpSettings(accessToken, companyId, {
        services: { ...settings.services, [serviceId]: checked },
      });
      setSettings(next);
      setUsingMock(companyAgentsUsingMock());
    } catch (e) {
      shellui.toast({
        type: 'error',
        title: e instanceof Error ? e.message : t('agentsSaveError'),
      });
    } finally {
      setSavingSettings(false);
    }
  }

  async function onToggleDestructive(agent: CompanyMcpAgent, checked: boolean) {
    if (!accessToken || companyId == null) return;
    if (checked) {
      const ok = await askShelluiConfirm({
        title: t('agentsDestructiveConfirmTitle'),
        description: t('agentsDestructiveConfirmDescription'),
        okLabel: t('agentsDestructiveConfirmOk'),
        cancelLabel: t('actionsCancel'),
        mode: 'delete',
      });
      if (!ok) return;
    }
    setBusyAgentId(agent.id);
    try {
      const updated = await patchCompanyMcpAgent(accessToken, companyId, agent.id, {
        allow_destructive_without_ask: checked,
      });
      setAgents((rows) => rows.map((a) => (a.id === updated.id ? updated : a)));
      setUsingMock(companyAgentsUsingMock());
    } catch (e) {
      shellui.toast({
        type: 'error',
        title: e instanceof Error ? e.message : t('agentsSaveError'),
      });
    } finally {
      setBusyAgentId(null);
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

  async function onResolveApproval(approval: CompanyMcpApproval, decision: 'approve' | 'reject') {
    if (!accessToken || companyId == null) return;
    setBusyApprovalId(approval.id);
    try {
      await resolveCompanyMcpApproval(accessToken, companyId, approval.id, decision);
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

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  return (
    <div className="w-full space-y-8">
      <PageHeader
        title={t('agentsPageTitle')}
        service={t('dashboardEnvBadge')}
        description={t('agentsPageDescription')}
      />

      {!accessToken && <p className="text-sm text-muted-foreground">{t('dashboardNoSession')}</p>}

      {accessToken && !isOwner && (
        <Alert>
          <AlertDescription>{t('agentsPageForbidden')}</AlertDescription>
        </Alert>
      )}

      {accessToken && isOwner ? (
        <>
          {usingMock ? (
            <Alert>
              <AlertDescription>{t('agentsMockNotice')}</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <SettingsSection
            id="agents-mcp"
            title={t('agentsMcpTitle')}
            description={t('agentsMcpDescription')}
            busy={loading || savingSettings}
            footerNote={settings?.enabled ? t('agentsMcpEnabledNote') : t('agentsMcpDisabledNote')}
          >
            <div className="space-y-6 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="agents-mcp-enabled">{t('agentsMcpEnableLabel')}</Label>
                  <p className="text-sm text-muted-foreground">{t('agentsMcpEnableHint')}</p>
                </div>
                <Switch
                  id="agents-mcp-enabled"
                  checked={settings?.enabled === true}
                  disabled={loading || savingSettings || !settings}
                  onCheckedChange={(v) => void onToggleEnabled(v)}
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">{t('agentsServicesLabel')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {MCP_SERVICE_IDS.map((serviceId) => (
                    <label
                      key={serviceId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={settings?.services[serviceId] === true}
                        disabled={
                          loading || savingSettings || !settings || settings.enabled !== true
                        }
                        onCheckedChange={(v) => void onToggleService(serviceId, v === true)}
                      />
                      {t(`agentsService_${serviceId}`)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">{t('agentsConnectTitle')}</p>
                <p className="text-sm text-muted-foreground">
                  {connectLine || t('agentsConnectMissingUrl')}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!mcpUrl}
                    onClick={() => void copyText(t('agentsCopyConnect'), connectLine)}
                  >
                    <Copy
                      className="mr-1.5 size-3.5"
                      aria-hidden
                    />
                    {t('agentsCopyConnect')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!mcpUrl}
                    onClick={() =>
                      void copyText(t('agentsCopyClaude'), claudeDesktopMcpConfig(mcpUrl))
                    }
                  >
                    {t('agentsCopyClaude')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!mcpUrl}
                    onClick={() => void copyText(t('agentsCopyCursor'), cursorMcpConfig(mcpUrl))}
                  >
                    {t('agentsCopyCursor')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!mcpUrl}
                    onClick={() =>
                      void copyText(t('agentsCopyGeneric'), genericMcpJsonConfig(mcpUrl))
                    }
                  >
                    {t('agentsCopyGeneric')}
                  </Button>
                </div>
              </div>
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
                        columns={['', '', '', '', '', '', '', '', '', '']}
                      />
                    </TableBody>
                  </Table>
                ) : agents.length === 0 ? (
                  <EmptyState
                    icon={Bot}
                    title={t('agentsListEmpty')}
                    description={t('agentsListEmptyHint')}
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('agentsColName')}</TableHead>
                        <TableHead>{t('agentsColClient')}</TableHead>
                        <TableHead>{t('agentsColAccess')}</TableHead>
                        <TableHead>{t('agentsColReadLevel')}</TableHead>
                        <TableHead>{t('agentsColServices')}</TableHead>
                        <TableHead>{t('agentsColDestructive')}</TableHead>
                        <TableHead>{t('agentsColExpiry')}</TableHead>
                        <TableHead>{t('agentsColLastCall')}</TableHead>
                        <TableHead>{t('agentsColStatus')}</TableHead>
                        <TableHead className="text-right">{t('agentsColActions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agents.map((agent) => {
                        const busy = busyAgentId === agent.id;
                        const selected = selectedAgentId === agent.id;
                        return (
                          <TableRow
                            key={agent.id}
                            className={cn(selected && 'bg-muted/40')}
                            onClick={() => setSelectedAgentId(agent.id)}
                          >
                            <TableCell className="font-medium">{agent.name}</TableCell>
                            <TableCell>{agent.client}</TableCell>
                            <TableCell>{t(`agentsAccess_${agent.access_mode}`)}</TableCell>
                            <TableCell>{t(`agentsReadLevel_${agent.read_level}`)}</TableCell>
                            <TableCell className="max-w-[140px] truncate">
                              {servicesLabel(agent.allowed_services, t)}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Switch
                                checked={agent.allow_destructive_without_ask}
                                disabled={
                                  busy || agent.status === 'revoked' || agent.status === 'paused'
                                }
                                aria-label={t('agentsColDestructive')}
                                onCheckedChange={(v) => void onToggleDestructive(agent, v)}
                              />
                            </TableCell>
                            <TableCell>{formatDateTime(agent.expires_at, locale)}</TableCell>
                            <TableCell>{formatDateTime(agent.last_call_at, locale)}</TableCell>
                            <TableCell>
                              <StatusBadge
                                tone={
                                  agent.status === 'active'
                                    ? 'success'
                                    : agent.status === 'paused'
                                      ? 'warning'
                                      : 'muted'
                                }
                              >
                                {t(`agentsStatus_${agent.status}`)}
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
                                  disabled={busy || agent.status !== 'active'}
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
                                  disabled={busy || agent.status === 'revoked'}
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
                )}
              </DataTableCard>

              {selectedAgent?.allow_destructive_without_ask ? (
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
                  {callLog.length === 0 ? (
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {callLog.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{formatDateTime(entry.at, locale)}</TableCell>
                            <TableCell className="font-mono text-xs">{entry.tool}</TableCell>
                            <TableCell>{entry.target}</TableCell>
                            <TableCell>{t(`agentsCallStatus_${entry.status}`)}</TableCell>
                            <TableCell className="text-right">{entry.duration_ms} ms</TableCell>
                          </TableRow>
                        ))}
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
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {approvals.map((approval) => {
                      const busy = busyApprovalId === approval.id;
                      const argsJson = JSON.stringify(approval.arguments, null, 2);
                      return (
                        <li
                          key={approval.id}
                          className="space-y-3 px-5 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm font-medium text-foreground">{approval.tool}</p>
                              <p className="text-sm text-muted-foreground">
                                {t('agentsApprovalMeta', {
                                  agent: approval.agent_name,
                                  target: approval.target,
                                })}
                              </p>
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
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
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
