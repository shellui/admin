import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Lock, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

function HostCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <header className="space-y-1 border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function EmptyHosts({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function LockedHostList({ hosts, empty }: { hosts: string[]; empty: string }) {
  if (hosts.length === 0) return <EmptyHosts text={empty} />;
  return (
    <ul className="divide-y divide-border">
      {hosts.map((host) => (
        <li
          key={host}
          className="flex items-center gap-2 py-2 first:pt-0 last:pb-0"
        >
          <Lock
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="font-mono text-sm">{host}</span>
        </li>
      ))}
    </ul>
  );
}

function HostNames({ hosts, empty }: { hosts: string[]; empty: string }) {
  if (hosts.length === 0) return <EmptyHosts text={empty} />;
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

  const addError = addFeedback?.tone === 'error';

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('emailLinkHostsTitle')}
        service="email-service"
        description={
          <>
            <span className="block">{t('emailLinkHostsDescription')}</span>
            {baseUrl ? (
              <span className="mt-1 block font-mono text-xs text-muted-foreground">{baseUrl}</span>
            ) : null}
          </>
        }
      />
      {!accessToken ? (
        <Alert variant="info">
          <AlertDescription>{t('dashboardNoSession')}</AlertDescription>
        </Alert>
      ) : null}
      {accessToken && !canManage ? (
        <Alert variant="warning">
          <AlertDescription>{t('emailForbidden')}</AlertDescription>
        </Alert>
      ) : null}
      {loading ? (
        <div
          className="space-y-4"
          aria-busy="true"
          aria-label={t('emailLoading')}
        >
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{emailErrorText(t, error)}</span>
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
      {record ? (
        <div className="space-y-4">
          <HostCard
            title={t('emailLinkHostsEffectiveTitle')}
            description={t('emailLinkHostsEffectiveDescription')}
          >
            <HostNames
              hosts={record.authLinkHosts}
              empty={t('emailLinkHostsNone')}
            />
          </HostCard>

          <HostCard
            title={t('emailLinkHostsExtraTitle')}
            description={t('emailLinkHostsExtraDescription')}
          >
            <div className="space-y-4">
              {record.hosts.length === 0 ? (
                <EmptyHosts text={t('emailLinkHostsNone')} />
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {record.hosts.map((host) => (
                    <li
                      key={host}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="font-mono text-sm">{host}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {removeFeedback?.host === host ? (
                          <ActionFeedback feedback={removeFeedback.feedback} />
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending !== null}
                          aria-label={t('emailLinkHostsRemoveNamed', { host })}
                          onClick={() => void removeHost(host)}
                        >
                          {pending === host ? (
                            <Loader2
                              className="size-3.5 animate-spin motion-reduce:animate-none"
                              aria-hidden
                            />
                          ) : (
                            <X
                              className="size-3.5"
                              aria-hidden
                            />
                          )}
                          {t('emailLinkHostsRemove')}
                        </Button>
                      </div>
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
                    aria-invalid={addError || undefined}
                    aria-describedby={addFeedback ? 'email-link-host-feedback' : undefined}
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
                        className="size-3.5 animate-spin motion-reduce:animate-none"
                        aria-hidden
                      />
                    ) : null}
                    {t('emailLinkHostsAdd')}
                  </Button>
                  <span
                    id="email-link-host-feedback"
                    className="basis-full"
                  >
                    <ActionFeedback feedback={addFeedback} />
                  </span>
                </div>
              </form>
            </div>
          </HostCard>

          <HostCard
            title={t('emailLinkHostsApplicationTitle')}
            description={t('emailLinkHostsApplicationDescription')}
          >
            <LockedHostList
              hosts={record.applicationHosts}
              empty={t('emailLinkHostsNone')}
            />
          </HostCard>

          <HostCard
            title={t('emailLinkHostsPlatformTitle')}
            description={t('emailLinkHostsPlatformDescription')}
          >
            <LockedHostList
              hosts={record.platformHosts}
              empty={t('emailLinkHostsNone')}
            />
          </HostCard>
        </div>
      ) : null}
    </div>
  );
}
