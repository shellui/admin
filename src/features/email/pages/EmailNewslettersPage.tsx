import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('emailNewslettersTitle')}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            email-service
          </Badge>
        </div>
        <Text className="max-w-3xl">{t('emailNewslettersDescription')}</Text>
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

      {!loading && canManage && newsletters && !error ? (
        <>
          {creating ? (
            <form
              className="max-w-md space-y-3 rounded-lg border border-border bg-card p-4"
              onSubmit={(ev) => void create(ev)}
            >
              <div className="space-y-1.5">
                <Label htmlFor="newsletter-name">{t('emailNewsletterName')}</Label>
                <Input
                  id="newsletter-name"
                  value={name}
                  maxLength={120}
                  autoFocus
                  placeholder={t('emailNewsletterNamePlaceholder')}
                  onChange={(ev) => setName(ev.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={busy}
                >
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  {t('emailNewsletterCreate')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreating(false)}
                >
                  {t('actionsCancel')}
                </Button>
              </div>
              <ActionFeedback feedback={feedback} />
            </form>
          ) : (
            <Button
              type="button"
              onClick={() => setCreating(true)}
            >
              <Plus />
              {t('emailNewsletterNew')}
            </Button>
          )}

          {newsletters.length === 0 ? (
            <Text>{t('emailNewslettersEmpty')}</Text>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {newsletters.map((newsletter) => (
                <li key={newsletter.id}>
                  <Link
                    to={emailNewsletterPath(newsletter.id)}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{newsletter.name}</span>
                      {newsletter.description ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {newsletter.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('emailNewsletterConfirmedCount', { count: newsletter.counts.confirmed })}
                    </span>
                    {newsletter.counts.pending ? (
                      <span className="text-xs text-muted-foreground">
                        {t('emailNewsletterPendingCount', { count: newsletter.counts.pending })}
                      </span>
                    ) : null}
                    {newsletter.counts.unsubscribed ? (
                      <span className="text-xs text-muted-foreground">
                        {t('emailNewsletterUnsubscribedCount', {
                          count: newsletter.counts.unsubscribed,
                        })}
                      </span>
                    ) : null}
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
