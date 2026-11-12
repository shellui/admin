import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import shellui from '@shellui/sdk';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { useShelluiAiService } from '@/hooks/useShelluiAiService';
import { notifyAgentsChanged } from '@/lib/agentConnectDrawer';
import { getCompanyIdFromJwt, getIsCompanyOwnerFromJwt } from '@/lib/jwtCompany';
import {
  MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS,
  buildAgentPrompt,
  buildCompanyMcpUrl,
  defaultPersonalAgentExpiresAt,
  formatDefaultAgentName,
  getDefaultPersonalAgentServices,
  isAbsoluteHttpUrl,
  isGlobalIdentitySession,
  personalAgentCreateErrorMessage,
  resolveAgentConnectPromptLocale,
} from '@/lib/mcpAgentsConnect';
import { createMcpPersonalAgent, fetchMcpPersonalStatus } from '@/lib/personalAgentsApi';
import type { McpPersonalStatus } from '@/lib/personalAgentsApi';

type IssuedSecret = {
  accessToken: string;
};

/** Connect form shown in a Shellui drawer (`#/agents/connect`, without the admin chrome). */
export function ConnectAgentPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const promptLocale = resolveAgentConnectPromptLocale(locale);
  const accessToken = useShelluiAccessToken();
  const companyId = accessToken ? getCompanyIdFromJwt(accessToken) : null;
  const isOwner = Boolean(accessToken && getIsCompanyOwnerFromJwt(accessToken));
  const aiService = useShelluiAiService();
  const mcpOrigin = aiService?.url ?? '';

  const [personalStatus, setPersonalStatus] = useState<McpPersonalStatus | null>(null);
  const [connectName, setConnectName] = useState('');
  const [creatingConnection, setCreatingConnection] = useState(false);
  const [createConnectionError, setCreateConnectionError] = useState<string | null>(null);
  const [issuedSecret, setIssuedSecret] = useState<IssuedSecret | null>(null);
  const staticDetailsRef = useRef<HTMLDetailsElement>(null);

  const includeSaas = isGlobalIdentitySession(personalStatus);
  const companyMcpUrl = useMemo(
    () => buildCompanyMcpUrl(mcpOrigin, companyId, personalStatus?.mcp_url),
    [mcpOrigin, companyId, personalStatus?.mcp_url],
  );
  const absoluteMcpUrl = companyMcpUrl && isAbsoluteHttpUrl(companyMcpUrl) ? companyMcpUrl : null;
  const connectPrompt = useMemo(() => {
    if (!absoluteMcpUrl) return null;
    return buildAgentPrompt(absoluteMcpUrl, promptLocale);
  }, [absoluteMcpUrl, promptLocale]);

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

  async function onCreateSecret() {
    if (!accessToken || companyId == null || !absoluteMcpUrl) return;
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
      setIssuedSecret({ accessToken: result.access_token });
      if (staticDetailsRef.current) {
        staticDetailsRef.current.open = true;
      }
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
          {!connectPrompt || !absoluteMcpUrl ? (
            <p className="text-sm text-muted-foreground">{t('agentsConnectMissingUrl')}</p>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{t('agentsConnectUrlLabel')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code
                    className="min-w-0 break-all font-mono text-xs"
                    translate="no"
                  >
                    {absoluteMcpUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyText(t('agentsCopyUrl'), absoluteMcpUrl)}
                  >
                    {t('agentsCopyUrl')}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {t('agentsConnectPromptLabel')}
                </p>
                <pre
                  className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted p-3 font-mono text-xs text-foreground"
                  translate="no"
                >
                  {connectPrompt}
                </pre>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(t('agentsCopyPrompt'), connectPrompt)}
                >
                  {t('agentsCopyPrompt')}
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('agentsConnectStepsLead')}</p>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>{t('agentsConnectStepPaste')}</li>
                  <li>{t('agentsConnectStepOpen')}</li>
                  <li>{t('agentsConnectStepAllow')}</li>
                </ol>
              </div>
              <details
                ref={staticDetailsRef}
                className="rounded-md border border-border bg-background"
              >
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                  {t('agentsStaticSecretSummary')}
                </summary>
                <div className="space-y-4 px-3 pb-3">
                  <p className="text-sm text-muted-foreground">{t('agentsStaticSecretHelper')}</p>
                  <p className="text-sm text-muted-foreground">{t('agentsStaticSecretOnce')}</p>
                  {issuedSecret ? (
                    <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                      <p className="text-sm font-medium">{t('agentsConnectCreatedTitle')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('agentsConnectCreatedHint')}
                      </p>
                      <pre
                        className="overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground"
                        translate="no"
                      >
                        {issuedSecret.accessToken}
                      </pre>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void copyText(t('agentsCopySecret'), issuedSecret.accessToken)
                          }
                        >
                          {t('agentsCopySecret')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIssuedSecret(null)}
                        >
                          {t('agentsHideSecret')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <h2 className="text-sm font-medium text-foreground">
                    {t('agentsStaticSecretCreateTitle')}
                  </h2>
                  <div className="space-y-2">
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
                      placeholder={t('agentsConnectNamePlaceholder')}
                      autoComplete="off"
                    />
                    <p className="text-sm text-muted-foreground">{t('agentsConnectNameHint')}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {includeSaas
                      ? t('agentsConnectAccessGlobal')
                      : t('agentsConnectAccessRegional')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('agentsConnectExpiry', { days: MCP_PERSONAL_AGENT_MAX_LIFETIME_DAYS })}
                  </p>
                  {createConnectionError ? (
                    <p className="text-sm text-destructive">{createConnectionError}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={creatingConnection}
                      onClick={() => void onCreateSecret()}
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={creatingConnection}
                      onClick={() => {
                        setCreateConnectionError(null);
                        setConnectName('');
                        if (staticDetailsRef.current) {
                          staticDetailsRef.current.open = false;
                        }
                      }}
                    >
                      {t('agentsConnectCancel')}
                    </Button>
                  </div>
                </div>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
}
