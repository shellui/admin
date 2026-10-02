import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Text } from '@/components/ui/text';
import {
  EmailTemplateEditor,
  type EmailLangDraft,
} from '@/features/email/components/EmailTemplateEditor';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { emailErrorText } from '@/lib/emailApiErrors';
import { validateAuthLaneOverride } from '@/lib/emailAuthTemplate';
import { emptyEmailDocument, type EmailLang, type EmailVariable } from '@/lib/emailDocument';
import { confirmAction } from '@/lib/confirmAction';
import type { EmailTemplateDefaults } from '@/lib/emailTypes';

function draftFromPack(
  defaults: EmailTemplateDefaults | null,
  lang: EmailLang,
  templateId: number | null,
): EmailLangDraft {
  const pack = defaults?.languages[lang];
  return {
    subject: pack?.subject ?? '',
    preheader: pack?.preheader ?? '',
    document: pack?.document ?? emptyEmailDocument(),
    templateId,
  };
}

export function EmailTemplateEditorPage() {
  const { t } = useTranslation();
  const params = useParams();
  const templateKey = decodeURIComponent(params.templateKey ?? '');
  const accessToken = useShelluiAccessToken();
  const { api, canManage } = useEmailApi(accessToken);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [defaults, setDefaults] = useState<EmailTemplateDefaults | null>(null);
  const [variables, setVariables] = useState<EmailVariable[]>([]);
  const [laneClass, setLaneClass] = useState('');
  const [draftEn, setDraftEn] = useState<EmailLangDraft>(() => draftFromPack(null, 'en', null));
  const [draftFr, setDraftFr] = useState<EmailLangDraft>(() => draftFromPack(null, 'fr', null));
  const [publishing, setPublishing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [serviceHtml, setServiceHtml] = useState<string | null>(null);
  const [serviceNote, setServiceNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!api || !canManage || !templateKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextDefaults, templates, catalog] = await Promise.all([
        api.fetchDefaults(templateKey),
        api.fetchTemplates(),
        api.fetchCatalog(),
      ]);
      const rows = templates.filter((row) => row.templateKey === templateKey);
      setLaneClass(catalog.find((event) => event.templateKey === templateKey)?.laneClass ?? '');
      const enId = rows.find((row) => row.language === 'en')?.id ?? null;
      const frId = rows.find((row) => row.language === 'fr')?.id ?? null;
      setDefaults(nextDefaults);
      setVariables(nextDefaults.variables);
      setDraftEn(draftFromPack(nextDefaults, 'en', enId));
      setDraftFr(draftFromPack(nextDefaults, 'fr', frId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [api, canManage, templateKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish(themeName: string | null, themePalette: Record<string, string>) {
    if (!api) return;
    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      for (const [lang, draft] of [
        ['en', draftEn],
        ['fr', draftFr],
      ] as const) {
        if (!draft.subject.trim()) continue;
        const issue = validateAuthLaneOverride({
          laneClass,
          variables,
          subject: draft.subject,
          preheader: draft.preheader,
          document: draft.document,
        });
        if (issue) {
          setError(issue);
          return;
        }
        let id = draft.templateId;
        if (!id) {
          const created = await api.createTemplate(templateKey, lang);
          id = created.id;
        }
        const version = await api.createVersion(id, {
          subject: draft.subject,
          preheader: draft.preheader,
          document: draft.document,
          ...(themeName ? { theme_name: themeName, theme_palette: themePalette } : {}),
        });
        await api.publishVersion(id, version.number);
      }
      setNotice(t('emailPublished'));
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setPublishing(false);
    }
  }

  async function reset() {
    if (!api) return;
    const confirmed = await confirmAction({
      title: t('emailResetTitle'),
      description: t('emailResetDescription', { name: templateKey }),
      okLabel: t('emailReset'),
      cancelLabel: t('actionsCancel'),
      danger: true,
    });
    if (!confirmed) return;
    setResetting(true);
    setError(null);
    try {
      for (const id of [draftEn.templateId, draftFr.templateId]) {
        if (id) await api.deleteTemplate(id);
      }
      setNotice(t('emailResetDone'));
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setResetting(false);
    }
  }

  async function preview(lang: EmailLang, draft: EmailLangDraft) {
    if (!api) return;
    setServiceNote(null);
    try {
      const variablesMap: Record<string, string> = {};
      for (const variable of variables) variablesMap[variable.token] = variable.example;
      const rendered = await api.render({
        template_key: templateKey,
        language: lang,
        document: draft.document,
        subject: draft.subject,
        variables: variablesMap,
      });
      setServiceHtml(rendered.html);
      setServiceNote(
        rendered.missingVariables.length
          ? t('emailMissingVariables', { tokens: rendered.missingVariables.join(', ') })
          : rendered.subject,
      );
    } catch (err) {
      setError(err);
    }
  }

  const hasCompany = Boolean(draftEn.templateId || draftFr.templateId);

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <Link
          to="/email/templates"
          className="font-mono text-xs text-primary underline-offset-2 hover:underline"
        >
          {t('emailBackToTemplates')}
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {t('emailEditorTitle')}
        </h1>
        <Text className="max-w-3xl">{t('emailEditorDescription')}</Text>
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
      {notice ? <Text className="font-mono text-sm">{notice}</Text> : null}
      {!loading && api && canManage && defaults ? (
        <EmailTemplateEditor
          templateKey={templateKey}
          laneClass={laneClass}
          draftEn={draftEn}
          draftFr={draftFr}
          variables={variables}
          hasCompanyTemplate={hasCompany}
          publishing={publishing}
          resetting={resetting}
          onChange={(lang, next) => (lang === 'fr' ? setDraftFr(next) : setDraftEn(next))}
          onPublish={(themeName, palette) => void publish(themeName, palette)}
          onReset={() => void reset()}
          onServicePreview={(lang, draft) => void preview(lang, draft)}
          servicePreviewHtml={serviceHtml}
          servicePreviewNote={serviceNote}
        />
      ) : null}
    </div>
  );
}
