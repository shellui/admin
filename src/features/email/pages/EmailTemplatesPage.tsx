import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Plus, SearchX } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/ui/button';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { EmailLibraryGrid } from '@/features/email/components/EmailLibraryGrid';
import { SearchField } from '@/features/email/components/SearchField';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import { emailErrorText } from '@/lib/emailApiErrors';
import { emailAssetsUrl } from '@/lib/emailLibrary';
import { filterByQuery } from '@/lib/emailList';
import type { EmailLibrary, EmailLibraryTemplate } from '@/lib/emailTypes';
import { emailLibraryTemplatePath } from '@/lib/webhookRoutePaths';

export function EmailTemplatesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const accessToken = useShelluiAccessToken();
  const { api, baseUrl, canManage } = useEmailApi(accessToken);
  const [library, setLibrary] = useState<EmailLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<number | 'new' | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedbackState | null>(null);

  const load = useCallback(async () => {
    if (!api || !canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setLibrary(await api.fetchLibrary());
    } catch (err) {
      setLibrary(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [api, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo<EmailLibrary | null>(
    () =>
      library && {
        sets: library.sets,
        templates: filterByQuery(
          library.templates,
          query,
          (row) => `${row.name} ${row.key} ${row.subject}`,
        ),
      },
    [library, query],
  );

  async function create(source?: EmailLibraryTemplate) {
    if (!api) return;
    setBusyId(source ? source.id : 'new');
    setFeedback(null);
    try {
      const created = await api.createLibraryTemplate(
        source ? { source_id: source.id } : { name: t('emailLibraryNewName') },
      );
      navigate(emailLibraryTemplatePath(created.id));
    } catch (err) {
      setFeedback(feedbackFromError(t, err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(template: EmailLibraryTemplate) {
    if (!api) return;
    const ok = await askShelluiConfirm({
      title: t('emailLibraryDeleteTitle'),
      description: t('emailLibraryDeleteDescription', { name: template.name }),
      okLabel: t('emailLibraryDelete'),
      cancelLabel: t('actionsCancel'),
      mode: 'delete',
    });
    if (!ok) return;
    setBusyId(template.id);
    setFeedback(null);
    try {
      await api.deleteLibraryTemplate(template.id);
      setLibrary(
        (prev) =>
          prev && { ...prev, templates: prev.templates.filter((row) => row.id !== template.id) },
      );
    } catch (err) {
      setFeedback(feedbackFromError(t, err));
    } finally {
      setBusyId(null);
    }
  }

  const ready = !loading && canManage && visible && !error;
  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t('emailTemplatesTitle')}
        service="email-service"
        description={t('emailTemplatesDescription')}
        actions={
          ready ? (
            <Button
              type="button"
              onClick={() => void create()}
              disabled={busyId !== null}
            >
              {busyId === 'new' ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Plus aria-hidden />
              )}
              {t('emailLibraryNew')}
            </Button>
          ) : null
        }
      />

      {!accessToken ? (
        <Alert>
          <AlertDescription>{t('dashboardNoSession')}</AlertDescription>
        </Alert>
      ) : null}
      {accessToken && !canManage ? (
        <Alert>
          <AlertDescription>{t('emailForbidden')}</AlertDescription>
        </Alert>
      ) : null}
      {loading ? (
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(256px,1fr))] gap-4"
          aria-busy
        >
          <span className="sr-only">{t('emailLoading')}</span>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              className="h-80 rounded-xl"
            />
          ))}
        </div>
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

      {ready ? (
        <>
          <div className="w-full sm:max-w-sm">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={t('emailTemplatesSearch')}
              label={t('emailTemplatesSearch')}
            />
          </div>
          {feedback ? <ActionFeedback feedback={feedback} /> : null}
          {query && visible.templates.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t('emailTemplatesEmpty')}
            />
          ) : (
            <EmailLibraryGrid
              library={visible}
              assetsUrl={emailAssetsUrl(baseUrl)}
              actions={(template) => (
                <>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                  >
                    <Link to={emailLibraryTemplatePath(template.id)}>
                      {template.builtIn ? t('emailLibraryOpen') : t('emailLibraryEdit')}
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busyId !== null}
                    onClick={() => void create(template)}
                  >
                    {busyId === template.id ? <Loader2 className="animate-spin" /> : null}
                    {t('emailLibraryDuplicate')}
                  </Button>
                  {template.builtIn ? null : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={busyId !== null}
                      onClick={() => void remove(template)}
                    >
                      {t('emailLibraryDelete')}
                    </Button>
                  )}
                </>
              )}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
