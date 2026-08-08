import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  fetchMemberCompanies,
  patchCompany,
  type CompanyAccessMode,
  type CompanyDto,
} from '@/lib/companiesApi';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

type Props = {
  accessToken: string;
};

const ACCESS_MODES: CompanyAccessMode[] = ['public', 'domain', 'invite'];

function domainsToText(domains: string[] | undefined): string {
  return (domains ?? []).join(', ');
}

function parseDomains(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, '').replace(/\.$/, ''))
    .filter(Boolean);
}

export function DashboardCompanySection({ accessToken }: Props) {
  const { t } = useTranslation();
  const companyId = getCompanyIdFromJwt(accessToken);
  const [company, setCompany] = useState<CompanyDto | null>(null);
  const [name, setName] = useState('');
  const [accessMode, setAccessMode] = useState<CompanyAccessMode>('public');
  const [domainsText, setDomainsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setCompany(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSaveMessage(null);
    try {
      const rows = await fetchMemberCompanies(accessToken);
      const row = rows.find((c) => c.id === companyId) ?? null;
      setCompany(row);
      setName(row?.name ?? '');
      setAccessMode(row?.access_mode ?? 'public');
      setDomainsText(domainsToText(row?.allowed_email_domains));
    } catch (e) {
      setCompany(null);
      setError(e instanceof Error ? e.message : t('dashboardCompanyLoadError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameDirty = Boolean(company && name.trim() !== '' && name.trim() !== company.name);
  const modeDirty = Boolean(company && accessMode !== (company.access_mode ?? 'public'));
  const domainsDirty = Boolean(
    company &&
    parseDomains(domainsText).join(',') !==
      (company.allowed_email_domains ?? []).map((d) => d.toLowerCase()).join(','),
  );
  const dirty = nameDirty || modeDirty || domainsDirty;
  const canSave =
    dirty &&
    name.trim() !== '' &&
    (accessMode !== 'domain' || parseDomains(domainsText).length > 0);

  const handleSave = useCallback(async () => {
    if (!company?.id) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (accessMode === 'domain' && parseDomains(domainsText).length === 0) {
      setError(t('dashboardCompanyDomainsRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const updated = await patchCompany(accessToken, company.id, {
        name: trimmed,
        access_mode: accessMode,
        allowed_email_domains: accessMode === 'domain' ? parseDomains(domainsText) : [],
      });
      setCompany(updated);
      setName(updated.name);
      setAccessMode(updated.access_mode ?? 'public');
      setDomainsText(domainsToText(updated.allowed_email_domains));
      setSaveMessage(t('dashboardCompanySaved'));
    } catch (e) {
      setSaveMessage(null);
      setError(e instanceof Error ? e.message : t('dashboardCompanySaveError'));
    } finally {
      setSaving(false);
    }
  }, [accessToken, accessMode, company?.id, domainsText, name, t]);

  if (loading) {
    return (
      <section
        className="space-y-3"
        aria-label={t('dashboardCompanySectionLabel')}
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

  if (!company) {
    return (
      <section aria-label={t('dashboardCompanySectionLabel')}>
        {error ? (
          <Text className="font-mono text-sm text-destructive">{error}</Text>
        ) : (
          <Text className="font-mono text-sm text-muted-foreground">
            {t('dashboardCompanyMissing')}
          </Text>
        )}
      </section>
    );
  }

  return (
    <section
      className="space-y-4"
      aria-label={t('dashboardCompanySectionLabel')}
    >
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-lg">
            <Building2
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            {t('dashboardCompanyTitle')}
          </CardTitle>
          <CardDescription className="font-mono text-xs">
            {t('dashboardCompanyDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="dashboard-company-name"
              className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
            >
              {t('dashboardCompanyNameLabel')}
            </label>
            <Input
              id="dashboard-company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-mono text-sm"
              autoComplete="organization"
            />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">
            <span className="text-muted-foreground/80">{t('dashboardCompanySlugLabel')}: </span>
            {company.slug}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-lg">
            <Shield
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            {t('dashboardCompanyAccessTitle')}
          </CardTitle>
          <CardDescription className="font-mono text-xs">
            {t('dashboardCompanyAccessDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset className="space-y-3">
            <legend className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {t('dashboardCompanyAccessModeLabel')}
            </legend>
            {ACCESS_MODES.map((mode) => (
              <label
                key={mode}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 px-3 py-2 hover:bg-muted/30"
              >
                <input
                  type="radio"
                  name="company-access-mode"
                  className="mt-1"
                  checked={accessMode === mode}
                  onChange={() => setAccessMode(mode)}
                />
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-medium">
                    {t(`dashboardCompanyAccessMode_${mode}`)}
                  </span>
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {t(`dashboardCompanyAccessModeHint_${mode}`)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {accessMode === 'domain' ? (
            <div className="space-y-2">
              <label
                htmlFor="dashboard-company-domains"
                className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
              >
                {t('dashboardCompanyDomainsLabel')}
              </label>
              <Input
                id="dashboard-company-domains"
                value={domainsText}
                onChange={(e) => setDomainsText(e.target.value)}
                className="font-mono text-sm"
                placeholder={t('dashboardCompanyDomainsPlaceholder')}
                autoComplete="off"
              />
              <p className="font-mono text-[10px] text-muted-foreground">
                {t('dashboardCompanyDomainsHint')}
              </p>
            </div>
          ) : null}

          {error ? <Text className="font-mono text-sm text-destructive">{error}</Text> : null}
          {saveMessage ? (
            <Text className="font-mono text-sm text-muted-foreground">{saveMessage}</Text>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={saving || !canSave}
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
