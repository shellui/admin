import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Loader2 } from 'lucide-react';
import shellui from '@shellui/sdk';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { useShelluiAiService } from '@/hooks/useShelluiAiService';
import { notifyAgentsChanged } from '@/lib/agentConnectDrawer';
import { getCompanyIdFromJwt, getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import {
  buildAgentPrompt,
  buildCompanyMcpUrl,
  defaultPersonalAgentExpiresAt,
  formatDefaultAgentName,
  getDefaultPersonalAgentServices,
  isGlobalIdentitySession,
  MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS,
  personalAgentCreateErrorMessage,
} from '@/lib/mcpAgentsConnect';
import { createMcpPersonalAgent, fetchMcpPersonalStatus } from '@/lib/personalAgentsApi';
import type { McpPersonalStatus } from '@/lib/personalAgentsApi';

type IssuedMcpConnection = {
  accessToken: string;
  mcpUrl: string;
  prompt: string;
};

/** Connect form shown in a Shellui drawer (`#/agents/connect`, without the admin chrome). */
export function ConnectAgentPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const accessToken = useShelluiAccessToken();
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const aiService = useShelluiAiService();
  const mcpOrigin = aiService?.url ?? '';

  const [personalStatus, setPersonalStatus] = useState<McpPersonalStatus | null>(null);
  const [connectName, setConnectName] = useState('');
  const [creatingConnection, setCreatingConnection] = useState(false);
  const [createConnectionError, setCreateConnectionError] = useState<string | null>(null);
  const [issuedConnection, setIssuedConnection] = useState<IssuedMcpConnection | null>(null);

  const includeSaas = isGlobalIdentitySession(personalStatus);
  const companyMcpUrl = useMemo(
    () => buildCompanyMcpUrl(mcpOrigin, companyId, personalStatus?.mcp_url),
    [mcpOrigin, companyId, personalStatus?.mcp_url],
  );

  useEffect(() => {
    if (!accessToken || companyId == null || !isOwner) return;
    let cancelled = false;
    void fetchMcpPersonalStatus(accessToken, companyId)
      .then((status) => {
        if (!cancelled) setPersonalStatus(status);
      })
      .catch(() => {
        if (!cancelled) setPersonalStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, companyId, isOwner]);

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      shellui.toast({ type: 'success', title: t('agentsCopied', { label }) });
    } catch {
      shellui.toast({ type: 'error', title: t('agentsCopyError') });
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
      notifyAgentsChanged();
    } catch (e) {
      setCreateConnectionError(
        personalAgentCreateErrorMessage(e, {
          expiryTooLong: t('agentsConnectExpiryTooLong'),
          fallback: t('agentsConnectCreateError'),
        }),
      );
    } finally {
      setCreatingConnection(false);
    }
  }

  return (
    <div className="bg-background p-6">
      <header className="space-y-1.5">
        <h1 className="font-heading text-lg font-semibold tracking-tight">
          {t('agentsConnectOpen')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('agentsConnectIntro')}</p>
      </header>

      {!accessToken ? (
        <p className="mt-6 text-sm text-muted-foreground">{t('dashboardNoSession')}</p>
      ) : !isOwner ? (
        <Alert className="mt-6">
          <AlertDescription>{t('agentsPageForbidden')}</AlertDescription>
        </Alert>
      ) : (
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
                  onClick={() => void copyText(t('agentsCopyToken'), issuedConnection.accessToken)}
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
              <p className="text-sm text-muted-foreground">
                {t('agentsConnectExpiry', { days: MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS })}
              </p>
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
      )}
    </div>
  );
}
