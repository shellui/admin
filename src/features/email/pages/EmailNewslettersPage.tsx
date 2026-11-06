import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Newspaper, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { emailErrorText } from '@/lib/emailApiErrors';
import { emailNewsletterPath, type Newsletter } from '@/lib/emailNewsletters';

export function EmailNewslettersPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const navigate = useNavigate();
  const accessToken = useShelluiAccessToken();
  const { api, canManage } = useEmailApi(accessToken);
  const [newsletters, setNewsletters] = useState<Newsletter[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
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
      setNewsletters(await api.fetchNewsletters());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [api, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(ev: FormEvent) {
    ev.preventDefault();
    if (!api || busy) return;
    if (!name.trim()) {
      setFeedback({ tone: 'error', text: t('emailNewsletterNameRequired') });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const created = await api.createNewsletter({
        name: name.trim(),
        default_language: lang === 'fr' ? 'fr' : 'en',
      });
      navigate(emailNewsletterPath(created.id));
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
        onClick={() => setCreating(true)}
      >
        <Plus aria-hidden />
        {t('emailNewsletterNew')}
      </Button>
    ) : null;
  const ready = !loading && canManage && newsletters && !error;
  const cols = [
    'pl-4',
    'text-right',
    'hidden text-right md:table-cell',
    'hidden pr-4 text-right md:table-cell',
  ];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('emailNewslettersTitle')}
        service="email-service"
        description={t('emailNewslettersDescription')}
        actions={ready && newsletters.length > 0 ? newButton : null}
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
        <form
          className="max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-xs"
          onSubmit={(ev) => void create(ev)}
        >
          <div className="space-y-3 p-4 sm:p-5">
            <h2 className="text-sm font-semibold">{t('emailNewsletterNew')}</h2>
            <div className="space-y-1.5">
              <Label htmlFor="newsletter-name">{t('emailNewsletterName')}</Label>
              <Input
                id="newsletter-name"
                value={name}
                maxLength={120}
                aria-required
                autoFocus
                placeholder={t('emailNewsletterNamePlaceholder')}
                onChange={(ev) => setName(ev.target.value)}
              />
            </div>
            <ActionFeedback feedback={feedback} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreating(false)}
            >
              {t('actionsCancel')}
            </Button>
            <Button
              type="submit"
              disabled={busy}
            >
              {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : null}
              {t('emailNewsletterCreate')}
            </Button>
          </div>
        </form>
      ) : null}

      {canManage && !error && (loading || newsletters) ? (
        <DataTableCard
          label={t('emailNewslettersTitle')}
          busy={loading}
        >
          {loading ? <span className="sr-only">{t('emailLoading')}</span> : null}
          {ready && newsletters.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title={t('emailNewslettersEmpty')}
              actions={newButton}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cols[0]}>{t('emailBroadcastsColName')}</TableHead>
                  <TableHead className={cols[1]}>{t('emailNewsletterStatus_confirmed')}</TableHead>
                  <TableHead className={cols[2]}>{t('emailNewsletterStatus_pending')}</TableHead>
                  <TableHead className={cols[3]}>
                    {t('emailNewsletterStatus_unsubscribed')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonRows
                    rows={3}
                    columns={cols}
                  />
                ) : null}
                {!loading &&
                  (newsletters ?? []).map((newsletter) => (
                    <TableRow key={newsletter.id}>
                      <TableCell className="pl-4">
                        <Link
                          to={emailNewsletterPath(newsletter.id)}
                          className="font-medium text-foreground hover:underline"
                        >
                          {newsletter.name}
                        </Link>
                        {newsletter.description ? (
                          <span className="block max-w-md truncate text-xs text-muted-foreground">
                            {newsletter.description}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell
                        className="text-right font-mono tabular-nums"
                        title={t('emailNewsletterConfirmedCount', {
                          count: newsletter.counts.confirmed,
                        })}
                      >
                        {newsletter.counts.confirmed}
                      </TableCell>
                      <TableCell
                        className="hidden text-right font-mono tabular-nums text-muted-foreground md:table-cell"
                        title={t('emailNewsletterPendingCount', {
                          count: newsletter.counts.pending,
                        })}
                      >
                        {newsletter.counts.pending}
                      </TableCell>
                      <TableCell
                        className="hidden pr-4 text-right font-mono tabular-nums text-muted-foreground md:table-cell"
                        title={t('emailNewsletterUnsubscribedCount', {
                          count: newsletter.counts.unsubscribed,
                        })}
                      >
                        {newsletter.counts.unsubscribed}
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
