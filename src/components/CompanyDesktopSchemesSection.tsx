import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppWindow, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { CompanyFieldError, fetchMemberCompanies, patchCompany } from '@/lib/companiesApi';
import {
  DESKTOP_SIGN_IN_DEEP_LINK_PLACEHOLDER,
  IDENTITY_DESKTOP_APPS_DOCS_URL,
  desktopRedirectSchemeIssue,
  desktopSchemeIssueMessageKey,
  desktopSignInDeepLink,
} from '@/lib/desktopRedirectScheme';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

type Props = {
  accessToken: string;
};

function committedSchemes(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const scheme = raw.trim();
    if (!scheme || desktopRedirectSchemeIssue(scheme) || seen.has(scheme)) continue;
    seen.add(scheme);
    out.push(scheme);
  }
  return out;
}

function deepLinkText(list: string[]): string {
  if (list.length === 0) return DESKTOP_SIGN_IN_DEEP_LINK_PLACEHOLDER;
  return [...new Set(list.map((scheme) => desktopSignInDeepLink(scheme)))].join(', ');
}

export function CompanyDesktopSchemesSection({ accessToken }: Props) {
  const { t } = useTranslation();
  const companyId = getCompanyIdFromJwt(accessToken);
  const [saved, setSaved] = useState<string[]>([]);
  const [schemes, setSchemes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [found, setFound] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setFound(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setFieldError(null);
    setSaveMessage(null);
    try {
      const rows = await fetchMemberCompanies(accessToken);
      const row = rows.find((company) => company.id === companyId) ?? null;
      const next = row?.desktop_redirect_schemes ?? [];
      setFound(Boolean(row));
      setSaved(next);
      setSchemes(next);
    } catch (e) {
      setFound(false);
      setError(e instanceof Error ? e.message : t('dashboardCompanyLoadError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const issues = schemes.map((scheme) =>
    scheme.trim() ? desktopRedirectSchemeIssue(scheme) : null,
  );
  const hasIssue = issues.some(Boolean);
  const nextList = committedSchemes(schemes);
  const dirty = nextList.join('\n') !== saved.join('\n') || hasIssue;

  const updateScheme = (index: number, value: string) => {
    setSchemes((prev) => prev.map((scheme, i) => (i === index ? value : scheme)));
    setFieldError(null);
    setSaveMessage(null);
  };

  const handleSave = useCallback(async () => {
    if (!companyId || hasIssue) return;
    setSaving(true);
    setError(null);
    setFieldError(null);
    setSaveMessage(null);
    try {
      const updated = await patchCompany(accessToken, companyId, {
        desktop_redirect_schemes: nextList,
      });
      const stored = updated.desktop_redirect_schemes ?? [];
      setSaved(stored);
      setSchemes(stored);
      setFound(true);
      setSaveMessage(t('dashboardCompanySaved'));
    } catch (e) {
      setSaveMessage(null);
      if (e instanceof CompanyFieldError && e.fieldErrors.desktop_redirect_schemes) {
        setFieldError(e.fieldErrors.desktop_redirect_schemes);
      } else {
        setError(e instanceof Error ? e.message : t('dashboardCompanySaveError'));
      }
    } finally {
      setSaving(false);
    }
  }, [accessToken, companyId, hasIssue, nextList, t]);

  if (loading) {
    return (
      <section
        className="space-y-3"
        aria-label={t('companyDesktopSchemesLabel')}
      >
        <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
          <Loader2
            className="size-4 animate-spin"
            aria-hidden
          />
          {t('dashboardCompanyLoading')}
        </div>
      </section>
    );
  }

  if (!found) {
    return (
      <section aria-label={t('companyDesktopSchemesLabel')}>
        <Text className="font-mono text-sm text-destructive">
          {error ?? t('dashboardCompanyMissing')}
        </Text>
      </section>
    );
  }

  return (
    <section
      className="space-y-4"
      aria-label={t('companyDesktopSchemesLabel')}
    >
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-lg">
            <AppWindow
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            {t('companyDesktopSchemesLabel')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {schemes.map((scheme, index) => {
              const issue = issues[index];
              const rowError = issue ? t(desktopSchemeIssueMessageKey(issue)) : '';
              return (
                <div
                  key={index}
                  className="flex items-start gap-2"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <label
                      htmlFor={`company-desktop-scheme-${index}`}
                      className="sr-only"
                    >
                      {t('companyDesktopSchemesLabel')} {index + 1}
                    </label>
                    <Input
                      id={`company-desktop-scheme-${index}`}
                      value={scheme}
                      onChange={(e) => updateScheme(index, e.target.value)}
                      className="font-mono text-sm"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-invalid={Boolean(rowError || fieldError)}
                      aria-describedby="company-desktop-schemes-help"
                    />
                    {rowError ? (
                      <Text className="font-mono text-xs text-destructive">{rowError}</Text>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSchemes((prev) => prev.filter((_, i) => i !== index));
                      setFieldError(null);
                      setSaveMessage(null);
                    }}
                  >
                    {t('companyDesktopSchemeRemove')}
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setSchemes((prev) => [...prev, '']);
                setFieldError(null);
                setSaveMessage(null);
              }}
            >
              {t('companyDesktopSchemeAdd')}
            </Button>
          </div>
          <Text
            id="company-desktop-schemes-help"
            className="font-mono text-[10px] text-muted-foreground"
          >
            {t('companyDesktopSchemesHelp')}{' '}
            <code className="text-foreground">{deepLinkText(schemes)}</code>
            {'. '}
            {t('companyDesktopSchemesDocsLead')}{' '}
            <a
              href={IDENTITY_DESKTOP_APPS_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {t('companyDesktopSchemesDocs')}
              <ExternalLink
                className="ml-0.5 inline h-3 w-3"
                aria-hidden
              />
            </a>
            {'.'}
          </Text>
          {fieldError ? (
            <Text className="font-mono text-xs text-destructive">{fieldError}</Text>
          ) : null}
          {error ? <Text className="font-mono text-sm text-destructive">{error}</Text> : null}
          {saveMessage ? (
            <Text className="font-mono text-sm text-muted-foreground">{saveMessage}</Text>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={saving || !dirty || hasIssue}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2
                  className="size-4 animate-spin"
                  aria-hidden
                />
                {t('dashboardCompanySaving')}
              </>
            ) : (
              t('dashboardCompanySave')
            )}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
