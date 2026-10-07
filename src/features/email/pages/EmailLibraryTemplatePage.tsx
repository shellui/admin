import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import {
  EmailTemplateEditor,
  type EmailDraft,
} from '@/features/email/components/EmailTemplateEditor';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { confirmAction } from '@/lib/confirmAction';
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
    const ok = await confirmAction({
      title: t('emailLibraryDeleteTitle'),
      description: t('emailLibraryDeleteDescription', { name: detail.name }),
      okLabel: t('emailLibraryDelete'),
      cancelLabel: t('actionsCancel'),
      danger: true,
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
      <header className="space-y-2">
        <Link
          to="/email/templates"
          className="font-mono text-xs text-primary underline-offset-2 hover:underline"
        >
          {t('emailBackToTemplates')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {detail?.name || t('emailTemplatesTitle')}
          </h1>
          {detail ? (
            <Badge variant="outline">
              {builtIn ? t('emailLibraryBuiltInBadge') : t('emailLibraryCustomBadge')}
            </Badge>
          ) : null}
          {detail && !builtIn ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto text-destructive"
              disabled={busy !== null}
              onClick={() => void remove()}
            >
              {busy === 'delete' ? <Loader2 className="animate-spin" /> : null}
              {t('emailLibraryDelete')}
            </Button>
          ) : null}
        </div>
        <Text className="max-w-3xl">
          {builtIn ? t('emailLibraryBuiltInHint') : t('emailLibraryCustomHint')}
        </Text>
        <ActionFeedback feedback={feedback} />
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

      {!loading && detail && draft ? (
        <>
          {builtIn ? null : (
            <div className="max-w-md space-y-1.5">
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
