import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import {
  feedbackFromError,
  type ActionFeedbackState,
} from '@/features/email/components/ActionFeedback';
import { EmailThemeSection } from '@/features/email/components/EmailThemeSection';
import { SearchField } from '@/features/email/components/SearchField';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { emailErrorText } from '@/lib/emailApiErrors';
import { filterByQuery, sectionTitle } from '@/lib/emailList';
import type { EmailCompanySettings, EmailTemplateRow, EmailTheme } from '@/lib/emailTypes';
import { emailTemplateEditorPath } from '@/lib/webhookRoutePaths';

function languageLabel(t: (key: string) => string, language: string): string {
  if (language === 'en') return t('emailLangEn');
  if (language === 'fr') return t('emailLangFr');
  return language;
}

export function EmailTemplatesPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const { api, baseUrl, canManage } = useEmailApi(accessToken);
  const [themes, setThemes] = useState<EmailTheme[]>([]);
  const [settings, setSettings] = useState<EmailCompanySettings | null>(null);
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [previews, setPreviews] = useState<Record<string, string | null | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState('');
  const [themeFeedback, setThemeFeedback] = useState<ActionFeedbackState | null>(null);

  const load = useCallback(async () => {
    if (!api || !canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextThemes, nextSettings, nextTemplates] = await Promise.all([
        api.fetchThemes(),
        api.fetchSettings(),
        api.fetchTemplates(),
      ]);
      setThemes(nextThemes);
      setSettings(nextSettings);
      setTemplates(nextTemplates);
    } catch (err) {
      setThemes([]);
      setSettings(null);
      setTemplates([]);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [api, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!api || themes.length === 0) return;
    let cancelled = false;
    for (const theme of themes) {
      void api
        .fetchThemePreview(theme.previewUrl)
        .then((html) => {
          if (!cancelled) setPreviews((prev) => ({ ...prev, [theme.key]: html }));
        })
        .catch(() => {
          if (!cancelled) setPreviews((prev) => ({ ...prev, [theme.key]: null }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [api, themes]);

  async function applyTheme(themeKey: string, applyToExisting: boolean) {
    if (!api) return;
    setThemeFeedback(null);
    try {
      const result = await api.saveSettings({
        theme: themeKey,
        apply_to_existing: applyToExisting,
      });
      setThemeFeedback({
        tone: 'success',
        text:
          result.updatedTemplates > 0
            ? t('emailThemeUpdatedCount', { count: result.updatedTemplates })
            : t('emailThemeUpdated'),
      });
      try {
        const next = await api.fetchSettings();
        setSettings(next);
        setTemplates(await api.fetchTemplates());
      } catch {
        setSettings({
          theme: result.theme,
          templatesUsingOtherTheme: applyToExisting ? 0 : (settings?.templatesUsingOtherTheme ?? 0),
        });
      }
    } catch (err) {
      setThemeFeedback(feedbackFromError(t, err));
    }
  }

  const themeName = (key: string) => themes.find((theme) => theme.key === key)?.name || key;
  const visible = filterByQuery(
    templates,
    query,
    (row) => `${row.name} ${row.eventType} ${row.language} ${row.theme} ${themeName(row.theme)}`,
  );

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

      {!loading && canManage && settings && !error ? (
        <>
          <EmailThemeSection
            themes={themes}
            currentKey={settings.theme}
            otherCount={settings.templatesUsingOtherTheme}
            previews={previews}
            feedback={themeFeedback}
            onApply={applyTheme}
          />
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              {sectionTitle(t('emailTemplatesCompany'), visible.length)}
            </h2>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={t('emailTemplatesSearch')}
              label={t('emailTemplatesSearch')}
            />
            {visible.length === 0 ? (
              <Text>
                {templates.length === 0
                  ? t('emailTemplatesCompanyEmpty')
                  : t('emailTemplatesEmpty')}
              </Text>
            ) : (
              <ul className="divide-y divide-border/80 rounded-md border border-border/80">
                {visible.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-3 py-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{row.name || row.templateKey}</p>
                        {row.usesCompanyTheme ? null : (
                          <Badge variant="outline">
                            {t('emailThemeOther', { name: themeName(row.theme) })}
                          </Badge>
                        )}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{row.eventType}</p>
                      <p className="text-xs text-muted-foreground">
                        {languageLabel(t, row.language)}
                      </p>
                    </div>
                    <Link
                      to={emailTemplateEditorPath(row.id)}
                      className="text-sm text-primary underline-offset-2 hover:underline"
                    >
                      {t('emailEditTemplate')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
