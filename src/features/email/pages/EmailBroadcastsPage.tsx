import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Megaphone, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableCard, SkeletonRows } from '@/components/admin/DataTableCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const newButton =
    canManage && !creating ? (
      <Button
        type="button"
        onClick={() => void openCreate()}
      >
        <Plus aria-hidden />
        {t('emailBroadcastNew')}
      </Button>
    ) : null;
  const cols = ['pl-4', '', 'hidden text-right md:table-cell', 'hidden pr-4 md:table-cell'];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('emailBroadcastsTitle')}
        service="email-service"
        description={t('emailBroadcastsDescription')}
        actions={!loading && broadcasts && broadcasts.length > 0 && !error ? newButton : null}
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
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-sm">{emailErrorText(t, error)}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void load()}
            >
              {t('usersRetry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {creating && canManage ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">{t('emailBroadcastNew')}</h2>
              <p className="text-[13px] text-muted-foreground">{t('emailBroadcastNewHint')}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
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
              aria-required
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
            <div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 motion-safe:animate-pulse"
              aria-busy
            >
              <span className="sr-only">{t('emailLoading')}</span>
              {[0, 1, 2].map((i) => (
                <Skeleton
                  key={i}
                  className="h-40 rounded-lg"
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {canManage && !error && (loading || broadcasts) ? (
        <DataTableCard
          label={t('emailBroadcastsTitle')}
          busy={loading}
        >
          {loading ? <span className="sr-only">{t('emailLoading')}</span> : null}
          {!loading && broadcasts && broadcasts.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title={t('emailBroadcastsEmpty')}
              actions={newButton}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cols[0]}>{t('emailBroadcastsColName')}</TableHead>
                  <TableHead>{t('emailBroadcastsColStatus')}</TableHead>
                  <TableHead className={cols[2]}>{t('emailBroadcastsColRecipients')}</TableHead>
                  <TableHead className={cols[3]}>{t('emailBroadcastsColDate')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonRows
                    rows={4}
                    columns={cols}
                  />
                ) : null}
                {!loading &&
                  (broadcasts ?? []).map((broadcast) => (
                    <TableRow key={broadcast.id}>
                      <TableCell className="pl-4">
                        <Link
                          to={emailBroadcastPath(broadcast.id)}
                          className="font-medium text-foreground hover:underline"
                        >
                          {broadcast.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground md:hidden">
                          {broadcast.counts
                            ? t('emailBroadcastRecipients', { count: broadcast.counts.total })
                            : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <BroadcastStateBadge state={broadcast.state} />
                      </TableCell>
                      <TableCell className="hidden text-right text-xs text-muted-foreground md:table-cell">
                        {broadcast.counts
                          ? t('emailBroadcastRecipients', { count: broadcast.counts.total })
                          : '-'}
                      </TableCell>
                      <TableCell className="hidden pr-4 text-xs text-muted-foreground md:table-cell">
                        {broadcast.sentAt
                          ? t('emailBroadcastSentOn', { date: formatDate(broadcast.sentAt, lang) })
                          : t('emailBroadcastCreatedOn', {
                              date: formatDate(broadcast.createdAt, lang),
                            })}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </DataTableCard>
      ) : null}
    </div>
  );
}
