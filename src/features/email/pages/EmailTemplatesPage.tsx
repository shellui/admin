import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { EmailLibraryGrid } from '@/features/email/components/EmailLibraryGrid';
import { SearchField } from '@/features/email/components/SearchField';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { confirmAction } from '@/lib/confirmAction';
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
    const ok = await confirmAction({
      title: t('emailLibraryDeleteTitle'),
      description: t('emailLibraryDeleteDescription', { name: template.name }),
      okLabel: t('emailLibraryDelete'),
      cancelLabel: t('actionsCancel'),
      danger: true,
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

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {t('emailTemplatesTitle')}
          </h1>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] uppercase"
          >
            email-service
          </Badge>
        </div>
        <Text className="max-w-3xl">{t('emailTemplatesDescription')}</Text>
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

      {!loading && canManage && visible && !error ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder={t('emailTemplatesSearch')}
                label={t('emailTemplatesSearch')}
              />
            </div>
            <Button
              type="button"
              onClick={() => void create()}
              disabled={busyId !== null}
            >
              {busyId === 'new' ? <Loader2 className="animate-spin" /> : <Plus />}
              {t('emailLibraryNew')}
            </Button>
          </div>
          {feedback ? <ActionFeedback feedback={feedback} /> : null}
          {query && visible.templates.length === 0 ? (
            <Text>{t('emailTemplatesEmpty')}</Text>
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
