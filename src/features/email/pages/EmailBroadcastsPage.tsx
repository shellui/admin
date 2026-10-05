import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useLang } from '@/contexts/LangContext';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { BroadcastStateBadge } from '@/features/email/components/BroadcastStatus';
import { EmailLibraryGrid } from '@/features/email/components/EmailLibraryGrid';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { emailErrorText } from '@/lib/emailApiErrors';
import { emailBroadcastPath, type Broadcast } from '@/lib/emailBroadcasts';
import { emailAssetsUrl } from '@/lib/emailLibrary';
import type { EmailLibrary, EmailLibraryTemplate } from '@/lib/emailTypes';

function formatDate(value: string | null, lang: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
}

export function EmailBroadcastsPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const navigate = useNavigate();
  const accessToken = useShelluiAccessToken();
  const { api, baseUrl, canManage } = useEmailApi(accessToken);
  const [broadcasts, setBroadcasts] = useState<Broadcast[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [library, setLibrary] = useState<EmailLibrary | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedbackState | null>(null);

  const load = useCallback(async () => {
    if (!api || !canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBroadcasts(await api.fetchBroadcasts());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [api, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openCreate() {
    setCreating(true);
    setFeedback(null);
    if (library || !api) return;
    try {
      setLibrary(await api.fetchLibrary());
    } catch (err) {
      setFeedback(feedbackFromError(t, err));
    }
  }

  async function create(template: EmailLibraryTemplate) {
    if (!api || busy) return;
    if (!name.trim()) {
      setFeedback({ tone: 'error', text: t('emailBroadcastNameRequired') });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const created = await api.createBroadcast({
        name: name.trim(),
        source_key: template.key,
        language: lang,
      });
      navigate(emailBroadcastPath(created.id));
    } catch (err) {
      setFeedback(feedbackFromError(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('emailBroadcastsTitle')}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            email-service
          </Badge>
        </div>
        <Text className="max-w-3xl">{t('emailBroadcastsDescription')}</Text>
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

      {!loading && canManage && broadcasts && !error ? (
        <>
          {creating ? (
            <section className="space-y-4 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold tracking-tight">
                    {t('emailBroadcastNew')}
                  </h2>
                  <Text className="text-xs">{t('emailBroadcastNewHint')}</Text>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreating(false)}
                >
                  {t('actionsCancel')}
                </Button>
              </div>
              <div className="max-w-md space-y-1.5">
                <Label htmlFor="broadcast-name">{t('emailBroadcastName')}</Label>
                <Input
                  id="broadcast-name"
                  value={name}
                  maxLength={120}
                  placeholder={t('emailBroadcastNamePlaceholder')}
                  onChange={(ev) => setName(ev.target.value)}
                />
              </div>
              <ActionFeedback feedback={feedback} />
              {library ? (
                <EmailLibraryGrid
                  library={library}
                  assetsUrl={emailAssetsUrl(baseUrl)}
                  selectedId={null}
                  onSelect={(template) => void create(template)}
                />
              ) : feedback ? null : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('emailLoading')}
                </div>
              )}
            </section>
          ) : (
            <Button
              type="button"
              onClick={() => void openCreate()}
            >
              <Plus />
              {t('emailBroadcastNew')}
            </Button>
          )}

          {broadcasts.length === 0 ? (
            <Text>{t('emailBroadcastsEmpty')}</Text>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {broadcasts.map((broadcast) => (
                <li key={broadcast.id}>
                  <Link
                    to={emailBroadcastPath(broadcast.id)}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{broadcast.name}</span>
                    {broadcast.counts ? (
                      <span className="text-xs text-muted-foreground">
                        {t('emailBroadcastRecipients', { count: broadcast.counts.total })}
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {broadcast.sentAt
                        ? t('emailBroadcastSentOn', { date: formatDate(broadcast.sentAt, lang) })
                        : t('emailBroadcastCreatedOn', {
                            date: formatDate(broadcast.createdAt, lang),
                          })}
                    </span>
                    <BroadcastStateBadge state={broadcast.state} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
