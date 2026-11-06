import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ActionFeedback,
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import {
  EmailTemplateEditor,
  type EmailDraft,
} from '@/features/email/components/EmailTemplateEditor';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { askShelluiConfirm } from '@/lib/shelluiConfirm';
import { emailErrorText } from '@/lib/emailApiErrors';
import { emailAssetsUrl } from '@/lib/emailLibrary';
import type { EmailLibraryDetail } from '@/lib/emailTypes';
import type { EmailTheme } from '@/lib/emailThemes';
import { useEmailThemes } from '@/features/email/useEmailThemes';
import { emailLibraryTemplatePath } from '@/lib/webhookRoutePaths';

/** One library design. Built-ins are read-only; company templates are edited and saved here. */
export function EmailLibraryTemplatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const libraryId = Number(params.libraryId);
  const accessToken = useShelluiAccessToken();
  const { api, baseUrl, canManage } = useEmailApi(accessToken);
  const [detail, setDetail] = useState<EmailLibraryDetail | null>(null);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [theme, setTheme] = useState<EmailTheme | null>(null);
  const emailThemes = useEmailThemes();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<'save' | 'duplicate' | 'delete' | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedbackState | null>(null);

  const load = useCallback(async () => {
    if (!api || !canManage || !Number.isFinite(libraryId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await api.fetchLibraryTemplate(libraryId);
      setDetail(next);
      setName(next.name);
      setDraft({ subject: next.subject, preheader: next.preheader, document: next.document });
      setTheme(next.theme);
    } catch (err) {
      setDetail(null);
      setDraft(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [api, canManage, libraryId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!api || !detail || !draft) return false;
    setBusy('save');
    try {
      const next = await api.updateLibraryTemplate(detail.id, {
        name,
        ...draft,
        theme: theme ?? {},
      });
      setDetail(next);
      setName(next.name);
    } finally {
      setBusy(null);
    }
  }

  async function duplicate() {
    if (!api || !detail) return false;
    setBusy('duplicate');
    try {
      const created = await api.createLibraryTemplate({
        source_id: detail.id,
        ...(theme ? { theme } : {}),
      });
      navigate(emailLibraryTemplatePath(created.id));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!api || !detail) return;
    const ok = await askShelluiConfirm({
      title: t('emailLibraryDeleteTitle'),
      description: t('emailLibraryDeleteDescription', { name: detail.name }),
      okLabel: t('emailLibraryDelete'),
      cancelLabel: t('actionsCancel'),
      mode: 'delete',
    });
    if (!ok) return;
    setBusy('delete');
    setFeedback(null);
    try {
      await api.deleteLibraryTemplate(detail.id);
      navigate('/email/templates');
    } catch (err) {
      setFeedback(feedbackFromError(t, err));
      setBusy(null);
    }
  }

  const builtIn = detail?.builtIn ?? false;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        back={{ to: '/email/templates', label: t('emailBackToTemplates') }}
        title={detail?.name || t('emailTemplatesTitle')}
        service="email-service"
        description={
          <span className="flex flex-wrap items-center gap-2">
            {detail ? (
              <StatusBadge tone={builtIn ? 'muted' : 'gold'}>
                {builtIn ? t('emailLibraryBuiltInBadge') : t('emailLibraryCustomBadge')}
              </StatusBadge>
            ) : null}
            <span>{builtIn ? t('emailLibraryBuiltInHint') : t('emailLibraryCustomHint')}</span>
          </span>
        }
        actions={
          detail && !builtIn ? (
            <Button
              type="button"
              variant="destructive"
              disabled={busy !== null}
              onClick={() => void remove()}
            >
              {busy === 'delete' ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Trash2 aria-hidden />
              )}
              {t('emailLibraryDelete')}
            </Button>
          ) : null
        }
      />
      <ActionFeedback feedback={feedback} />

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
          className="space-y-3"
          aria-busy
        >
          <span className="sr-only">{t('emailLoading')}</span>
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="h-112 w-full rounded-xl" />
        </div>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="font-mono text-sm">
            {emailErrorText(t, error)}
          </AlertDescription>
        </Alert>
      ) : null}

      {!loading && detail && draft ? (
        <>
          {builtIn ? null : (
            <div className="max-w-md space-y-1.5 rounded-xl border border-border bg-card p-4 shadow-xs">
              <Label htmlFor="email-library-name">{t('emailLibraryName')}</Label>
              <Input
                id="email-library-name"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          )}
          <EmailTemplateEditor
            laneClass=""
            authLinkHosts={[]}
            head={detail.head}
            assetsUrl={emailAssetsUrl(baseUrl)}
            draft={draft}
            variables={detail.variables}
            readOnly={builtIn}
            primary={
              builtIn
                ? {
                    label: t('emailLibraryDuplicateToEdit'),
                    busy: busy === 'duplicate',
                    disabled: busy !== null,
                    run: duplicate,
                    doneText: '',
                  }
                : {
                    label: busy === 'save' ? t('emailSaving') : t('emailSave'),
                    busy: busy === 'save',
                    disabled: busy !== null || !name.trim(),
                    run: save,
                    doneText: t('emailSaved'),
                  }
            }
            theme={{ value: theme, themes: emailThemes.themes, onChange: setTheme }}
            onChange={setDraft}
          />
        </>
      ) : null}
    </div>
  );
}
