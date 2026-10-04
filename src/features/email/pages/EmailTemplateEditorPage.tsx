import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import {
  EmailTemplateEditor,
  type EmailLangDraft,
} from '@/features/email/components/EmailTemplateEditor';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { EmailApiError, emailErrorText } from '@/lib/emailApiErrors';
import { validateAuthLaneOverride } from '@/lib/emailAuthTemplate';
import { emptyEmailDocument, type EmailLang, type EmailVariable } from '@/lib/emailDocument';
import { confirmAction } from '@/lib/confirmAction';
import { preferredTemplateVersion } from '@/lib/emailApiParsers';
import { emailThemeKeyOrDefault } from '@/lib/emailTheme';
import { getEmailFromJwt, getIsStaffFromJwt } from '@/lib/jwtCompany';
import type {
  EmailCatalogEvent,
  EmailTemplateDefaults,
  EmailTemplateRow,
  EmailTemplateVersion,
} from '@/lib/emailTypes';

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
  const templateIdParam = params.templateId ? Number(params.templateId) : null;
  const templateKey = params.templateKey ? decodeURIComponent(params.templateKey) : '';
  const accessToken = useShelluiAccessToken();
  const { api, canManage } = useEmailApi(accessToken);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [defaults, setDefaults] = useState<EmailTemplateDefaults | null>(null);
  const [variables, setVariables] = useState<EmailVariable[]>([]);
  const [laneClass, setLaneClass] = useState('');
  const [authLinkHosts, setAuthLinkHosts] = useState<string[]>([]);
  const [storedTemplate, setStoredTemplate] = useState<string | null>(null);
  const [draftEn, setDraftEn] = useState<EmailLangDraft>(() => draftFromPack(null, 'en', null));
  const [draftFr, setDraftFr] = useState<EmailLangDraft>(() => draftFromPack(null, 'fr', null));
  const [publishing, setPublishing] = useState(false);
  const [sendingDraft, setSendingDraft] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [companyTemplate, setCompanyTemplate] = useState('barebone');
  const [storedPalette, setStoredPalette] = useState<Record<string, string> | null>(null);
  const [languages, setLanguages] = useState<EmailLang[]>(['en', 'fr']);
  const [openedRow, setOpenedRow] = useState<EmailTemplateRow | null>(null);
  const [catalogEvent, setCatalogEvent] = useState<EmailCatalogEvent | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!api || !canManage || (!templateKey && !templateIdParam)) {
        setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const settings = await api.fetchSettings();
        setCompanyTemplate(emailThemeKeyOrDefault(settings.theme, 'barebone'));
        if (templateIdParam) {
          const [templates, catalog] = await Promise.all([
            api.fetchTemplates(),
            api.fetchCatalog(),
          ]);
          const row = templates.find((item) => item.id === templateIdParam) ?? null;
          if (!row) throw new EmailApiError('template_not_found', 404);
          setOpenedRow(row);
          const lang: EmailLang = row.language === 'fr' ? 'fr' : 'en';
          setLanguages([lang]);
          const event = catalog.events.find((item) => item.eventType === row.eventType);
          setCatalogEvent(event ?? null);
          setLaneClass(event?.laneClass ?? '');
          setAuthLinkHosts(catalog.authLinkHosts);
          setVariables(event?.variables ?? []);
          const version = row.activeVersion
            ? await api.fetchVersion(row.id, row.activeVersion)
            : preferredTemplateVersion(await api.fetchVersions(row.id));
          const base = draftFromPack(null, lang, row.id);
          const nextDraft = version
            ? {
                ...base,
                subject: version.subject,
                preheader: version.preheader,
                document: version.document,
              }
            : base;
          setStoredTemplate(
            emailThemeKeyOrDefault(version?.themeName || row.theme, settings.theme),
          );
          setStoredPalette(version?.themePalette ?? null);
          setDefaults({
            templateKey: row.templateKey,
            languages: {
              [lang]: {
                subject: nextDraft.subject,
                preheader: nextDraft.preheader,
                document: nextDraft.document,
              },
            },
            variables: event?.variables ?? [],
          });
          if (lang === 'fr') {
            setDraftFr(nextDraft);
            setDraftEn(draftFromPack(null, 'en', null));
          } else {
            setDraftEn(nextDraft);
            setDraftFr(draftFromPack(null, 'fr', null));
          }
          return;
        }
        const [nextDefaults, templates, catalog] = await Promise.all([
          api.fetchDefaults(templateKey),
          api.fetchTemplates(),
          api.fetchCatalog(),
        ]);
        const rows = templates.filter((row) => row.templateKey === templateKey);
        const event = catalog.events.find((item) => item.templateKey === templateKey) ?? null;
        setCatalogEvent(event);
        setLaneClass(event?.laneClass ?? '');
        setAuthLinkHosts(catalog.authLinkHosts);
        const opened = await Promise.all(
          rows.map(async (row) => {
            const version = row.activeVersion
              ? await api.fetchVersion(row.id, row.activeVersion)
              : preferredTemplateVersion(await api.fetchVersions(row.id));
            return { row, version };
          }),
        );
        const versionFor = (lang: EmailLang): EmailTemplateVersion | null =>
          opened.find((item) => item.row.language === lang)?.version ?? null;
        const withVersion = (lang: EmailLang, id: number | null): EmailLangDraft => {
          const base = draftFromPack(nextDefaults, lang, id);
          const version = versionFor(lang);
          if (!version) return base;
          const hasDocument =
            version.document.preview.length > 0 || version.document.blocks.length > 0;
          return {
            ...base,
            subject: version.subject || base.subject,
            preheader: version.preheader || base.preheader,
            document: hasDocument ? version.document : base.document,
          };
        };
        const enId = rows.find((row) => row.language === 'en')?.id ?? null;
        const frId = rows.find((row) => row.language === 'fr')?.id ?? null;
        const stored = versionFor('en')?.themeName || versionFor('fr')?.themeName || null;
        setStoredTemplate(stored ? emailThemeKeyOrDefault(stored, settings.theme) : null);
        setStoredPalette(versionFor('en')?.themePalette || versionFor('fr')?.themePalette || null);
        setLanguages(['en', 'fr']);
        setOpenedRow(null);
        setDefaults(nextDefaults);
        setVariables(nextDefaults.variables);
        setDraftEn(withVersion('en', enId));
        setDraftFr(withVersion('fr', frId));
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [api, canManage, templateIdParam, templateKey],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function publish(template: string, themePalette: Record<string, string>) {
    if (!api) return;
    setPublishing(true);
    try {
      for (const [lang, draft] of [
        ['en', draftEn],
        ['fr', draftFr],
      ] as const) {
        if (!draft.subject.trim()) continue;
        const issue = validateAuthLaneOverride({
          laneClass,
          variables,
          authLinkHosts,
          subject: draft.subject,
          preheader: draft.preheader,
          document: draft.document,
        });
        if (issue) throw issue;
        let id = draft.templateId;
        if (!id) {
          const created = await api.createTemplate(templateKey, lang);
          id = created.id;
        }
        const version = await api.createVersion(id, {
          subject: draft.subject,
          preheader: draft.preheader,
          document: draft.document,
          theme_name: emailThemeKeyOrDefault(template, companyTemplate),
          theme_palette: Object.keys(themePalette).length === 7 ? themePalette : {},
        });
        await api.publishVersion(id, version.number);
      }
      await load({ silent: true });
    } finally {
      setPublishing(false);
    }
  }

  async function reset() {
    if (!api) return false;
    const confirmed = await confirmAction({
      title: t('emailResetTitle'),
      description: t('emailResetDescription', { name: templateKey }),
      okLabel: t('emailReset'),
      cancelLabel: t('actionsCancel'),
      danger: true,
    });
    if (!confirmed) return false;
    setResetting(true);
    try {
      for (const id of [draftEn.templateId, draftFr.templateId]) {
        if (id) await api.deleteTemplate(id);
      }
      await load({ silent: true });
      return true;
    } finally {
      setResetting(false);
    }
  }

  async function sendDraft(
    lang: EmailLang,
    draft: EmailLangDraft,
    template: string,
    themePalette: Record<string, string>,
    to?: string,
  ) {
    if (!api) return;
    const issue = validateAuthLaneOverride({
      laneClass,
      variables,
      authLinkHosts,
      subject: draft.subject,
      preheader: draft.preheader,
      document: draft.document,
    });
    if (issue) throw issue;
    setSendingDraft(true);
    try {
      let id = draft.templateId;
      if (!id) {
        const created = await api.createTemplate(templateKey, lang);
        id = created.id;
        const next = { ...draft, templateId: id };
        if (lang === 'fr') setDraftFr(next);
        else setDraftEn(next);
      }
      await api.sendTemplateTest(id, {
        document: draft.document,
        subject: draft.subject,
        preheader: draft.preheader,
        theme_name: emailThemeKeyOrDefault(template, companyTemplate),
        theme_palette: themePalette,
        ...(to ? { to } : {}),
      });
    } finally {
      setSendingDraft(false);
    }
  }

  const hasCompany = Boolean(draftEn.templateId || draftFr.templateId);
  const loaded = Boolean(defaults);
  const title = (loaded && (openedRow?.name || catalogEvent?.label)) || t('emailEditorTitle');
  const eventType = openedRow?.eventType || catalogEvent?.eventType || '';
  const eventLabel = catalogEvent?.label && catalogEvent.label !== title ? catalogEvent.label : '';
  const laneLabel = laneClass ? t(`emailLane_${laneClass}`, { defaultValue: '' }) : '';

  return (
    <div className="w-full space-y-6">
      <header className="space-y-2">
        <Link
          to="/email/templates"
          className="font-mono text-xs text-primary underline-offset-2 hover:underline"
        >
          {t('emailBackToTemplates')}
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {loaded && eventType ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">{t('emailEditorSentFor')}</span>
            {eventLabel ? <span className="font-medium">{eventLabel}</span> : null}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{eventType}</code>
            {laneLabel ? <Badge variant="outline">{laneLabel}</Badge> : null}
          </p>
        ) : null}
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
      {!loading && api && canManage && defaults ? (
        <EmailTemplateEditor
          laneClass={laneClass}
          authLinkHosts={authLinkHosts}
          storedTemplate={storedTemplate}
          storedPalette={storedPalette}
          companyTemplate={companyTemplate}
          languages={languages}
          draftEn={draftEn}
          draftFr={draftFr}
          variables={variables}
          hasCompanyTemplate={hasCompany}
          publishing={publishing}
          resetting={resetting}
          sendingDraft={sendingDraft}
          isStaff={Boolean(accessToken && getIsStaffFromJwt(accessToken))}
          jwtEmail={accessToken ? getEmailFromJwt(accessToken) : null}
          onChange={(lang, next) => (lang === 'fr' ? setDraftFr(next) : setDraftEn(next))}
          onPublish={(template, palette) => publish(template, palette)}
          onReset={() => reset()}
          onSendDraft={(lang, draft, template, palette, to) =>
            sendDraft(lang, draft, template, palette, to)
          }
        />
      ) : null}
    </div>
  );
}
