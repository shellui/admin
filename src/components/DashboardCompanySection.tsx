import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { fetchMemberCompanies, patchCompany, type CompanyDto } from '@/lib/companiesApi';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

type Props = {
  accessToken: string;
};

export function DashboardCompanySection({ accessToken }: Props) {
  const { t } = useTranslation();
  const companyId = getCompanyIdFromJwt(accessToken);
  const [company, setCompany] = useState<CompanyDto | null>(null);
  const [name, setName] = useState('');
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

  const handleSave = useCallback(async () => {
    if (!company?.id) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const updated = await patchCompany(accessToken, company.id, { name: trimmed });
      setCompany(updated);
      setName(updated.name);
      setSaveMessage(t('dashboardCompanySaved'));
    } catch (e) {
      setSaveMessage(null);
      setError(e instanceof Error ? e.message : t('dashboardCompanySaveError'));
    } finally {
      setSaving(false);
    }
  }, [accessToken, company?.id, name, t]);

  if (loading) {
    return (
      <section
        className="space-y-3"
        aria-label={t('dashboardCompanySectionLabel')}
      >
        <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
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
          <Text className="font-mono text-sm text-muted-foreground">{t('dashboardCompanyMissing')}</Text>
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
            <Building2 className="size-4 text-muted-foreground" aria-hidden />
            {t('dashboardCompanyTitle')}
          </CardTitle>
          <CardDescription className="font-mono text-xs">{t('dashboardCompanyDescription')}</CardDescription>
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
          {error ? <Text className="font-mono text-sm text-destructive">{error}</Text> : null}
          {saveMessage ? (
            <Text className="font-mono text-sm text-muted-foreground">{saveMessage}</Text>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={saving || name.trim() === '' || name.trim() === company.name}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
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
