import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { EmailApiError, emailErrorText } from '@/lib/emailApiErrors';
import { classifyExtraHost, MAX_EXTRA_LINK_HOSTS } from '@/lib/emailLinkHosts';
import type { AuthLinkHosts } from '@/lib/emailTypes';

function hostErrorText(t: (key: string) => string, error: unknown): ActionFeedbackState {
  if (error instanceof EmailApiError) {
    const code = error.fieldErrors.hosts?.[0];
    if (code) {
      const key = `emailLinkHostError_${code}`;
      const text = t(key);
      if (text !== key) return { tone: 'error', text };
    }
  }
  return feedbackFromError(t, error);
}

function HostNames({ hosts, empty }: { hosts: string[]; empty: string }) {
  if (hosts.length === 0) {
    return <Text className="font-mono text-sm text-muted-foreground">{empty}</Text>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {hosts.map((host) => (
        <li key={host}>
          <Badge
            variant="muted"
            className="font-mono text-xs"
          >
            {host}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function EmailLinkHostsPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const { api, baseUrl, canManage } = useEmailApi(accessToken);
  const [record, setRecord] = useState<AuthLinkHosts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<'add' | string | null>(null);
  const [addFeedback, setAddFeedback] = useState<ActionFeedbackState | null>(null);
  const [removeFeedback, setRemoveFeedback] = useState<{
    host: string;
    feedback: ActionFeedbackState;
  } | null>(null);

  const load = useCallback(async () => {
    if (!api || !canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRecord(await api.fetchAuthLinkHosts());
    } catch (err) {
      setRecord(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [api, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addHost() {
    if (!api || !record) return;
    setAddFeedback(null);
    setRemoveFeedback(null);
    const parsed = classifyExtraHost(draft);
    if ('code' in parsed) {
      setAddFeedback({ tone: 'error', text: t(`emailLinkHostError_${parsed.code}`) });
      return;
    }
    if (record.hosts.includes(parsed.host)) {
      setAddFeedback({ tone: 'error', text: t('emailLinkHostError_duplicate') });
      return;
    }
    if (record.hosts.length >= MAX_EXTRA_LINK_HOSTS) {
      setAddFeedback({ tone: 'error', text: t('emailLinkHostError_too_many') });
      return;
    }
    setPending('add');
    try {
      const next = await api.saveAuthLinkHosts([...record.hosts, parsed.host].sort());
      setRecord(next);
      setDraft('');
      setAddFeedback({ tone: 'success', text: t('emailLinkHostsAdded') });
    } catch (err) {
      setAddFeedback(hostErrorText(t, err));
    } finally {
      setPending(null);
    }
  }

  async function removeHost(host: string) {
    if (!api || !record) return;
    setAddFeedback(null);
    setRemoveFeedback(null);
    setPending(host);
    try {
      const next = await api.saveAuthLinkHosts(record.hosts.filter((item) => item !== host));
      setRecord(next);
      setRemoveFeedback({
        host,
        feedback: { tone: 'success', text: t('emailLinkHostsRemoved') },
      });
    } catch (err) {
      setRemoveFeedback({ host, feedback: hostErrorText(t, err) });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('emailLinkHostsTitle')}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            email-service
          </Badge>
        </div>
        <Text className="max-w-3xl">{t('emailLinkHostsDescription')}</Text>
        <Text className="font-mono text-xs text-muted-foreground">{baseUrl}</Text>
      </header>
      {!accessToken ? <Text>{t('dashboardNoSession')}</Text> : null}
      {accessToken && !canManage ? <Text>{t('emailForbidden')}</Text> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('emailLoading')}
        </div>
      ) : null}
      {error ? (
        <Text className="font-mono text-sm text-destructive">{emailErrorText(t, error)}</Text>
      ) : null}
      {record ? (
        <div className="space-y-8">
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t('emailLinkHostsEffectiveTitle')}</h2>
            <Text>{t('emailLinkHostsEffectiveDescription')}</Text>
            <HostNames
              hosts={record.authLinkHosts}
              empty={t('emailLinkHostsNone')}
            />
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t('emailLinkHostsApplicationTitle')}</h2>
            <Text>{t('emailLinkHostsApplicationDescription')}</Text>
            <HostNames
              hosts={record.applicationHosts}
              empty={t('emailLinkHostsNone')}
            />
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t('emailLinkHostsPlatformTitle')}</h2>
            <Text>{t('emailLinkHostsPlatformDescription')}</Text>
            <HostNames
              hosts={record.platformHosts}
              empty={t('emailLinkHostsNone')}
            />
          </section>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t('emailLinkHostsExtraTitle')}</h2>
            <Text>{t('emailLinkHostsExtraDescription')}</Text>
            {record.hosts.length === 0 ? (
              <Text className="font-mono text-sm text-muted-foreground">
                {t('emailLinkHostsNone')}
              </Text>
            ) : (
              <ul className="space-y-2">
                {record.hosts.map((host) => (
                  <li
                    key={host}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="font-mono text-sm">{host}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending !== null}
                      aria-label={t('emailLinkHostsRemoveNamed', { host })}
                      onClick={() => void removeHost(host)}
                    >
                      {pending === host ? (
                        <Loader2
                          className="size-3.5 animate-spin"
                          aria-hidden
                        />
                      ) : null}
                      {t('emailLinkHostsRemove')}
                    </Button>
                    {removeFeedback?.host === host ? (
                      <ActionFeedback feedback={removeFeedback.feedback} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {removeFeedback && !record.hosts.includes(removeFeedback.host) ? (
              <ActionFeedback feedback={removeFeedback.feedback} />
            ) : null}
            <form
              className="max-w-xl space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void addHost();
              }}
            >
              <Label htmlFor="email-link-host">{t('emailLinkHostsField')}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="email-link-host"
                  value={draft}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="app.example.com"
                  className="max-w-sm font-mono"
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setAddFeedback(null);
                  }}
                />
                <Button
                  type="submit"
                  disabled={pending !== null}
                >
                  {pending === 'add' ? (
                    <Loader2
                      className="size-3.5 animate-spin"
                      aria-hidden
                    />
                  ) : null}
                  {t('emailLinkHostsAdd')}
                </Button>
                <ActionFeedback feedback={addFeedback} />
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
