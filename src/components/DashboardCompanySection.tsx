import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AtSign, Globe, Loader2, Mail, UserPlus } from 'lucide-react';
import shellui from '@shellui/sdk';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SettingsSection } from '@/components/admin/SettingsSection';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  fetchMemberCompanies,
  patchCompany,
  type CompanyAccessMode,
  type CompanyDto,
} from '@/lib/companiesApi';
import { openInviteUserModal } from '@/lib/inviteModal';
import { PendingInvitationsButton } from '@/components/PendingInvitationsButton';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

type Props = {
  accessToken: string;
};

const ACCESS_MODES: CompanyAccessMode[] = ['public', 'domain', 'invite'];
const MODE_ICONS = { public: Globe, domain: AtSign, invite: Mail } as const;

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
      shellui.toast({ type: 'success', title: t('dashboardCompanySaved') });
    } catch (e) {
      setSaveMessage(null);
      setError(e instanceof Error ? e.message : t('dashboardCompanySaveError'));
    } finally {
      setSaving(false);
    }
  }, [accessToken, accessMode, company?.id, domainsText, name, t]);

  const saveButton = (
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
  );

  if (loading) {
    return (
      <section
        aria-label={t('dashboardCompanySectionLabel')}
        aria-busy
        className="space-y-3 rounded-xl border border-border bg-card p-5"
      >
        <span className="sr-only">{t('dashboardCompanyLoading')}</span>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </section>
    );
  }

  if (!company) {
    return (
      <section aria-label={t('dashboardCompanySectionLabel')}>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
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
        ) : (
          <Text className="text-sm text-muted-foreground">{t('dashboardCompanyMissing')}</Text>
        )}
      </section>
    );
  }

  const status = error ? <span className="text-destructive">{error}</span> : (saveMessage ?? null);

  return (
    <section
      className="space-y-8"
      aria-label={t('dashboardCompanySectionLabel')}
    >
      <SettingsSection
        id="company-profile"
        title={t('dashboardCompanyTitle')}
        description={t('dashboardCompanyDescription')}
        footerNote={<span className="font-mono">PATCH /api/v1/companies/{company.id}/</span>}
        footerAction={saveButton}
      >
        <div className="space-y-2">
          <label
            htmlFor="dashboard-company-name"
            className="text-sm font-medium"
          >
            {t('dashboardCompanyNameLabel')}
          </label>
          <Input
            id="dashboard-company-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="organization"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="dashboard-company-slug"
            className="text-sm font-medium"
          >
            {t('dashboardCompanySlugLabel')}
          </label>
          <Input
            id="dashboard-company-slug"
            value={company.slug}
            readOnly
            aria-readonly
            className="bg-muted font-mono"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        id="company-access"
        title={t('dashboardCompanyAccessTitle')}
        description={t('dashboardCompanyAccessDescription')}
        footerNote={status}
        footerAction={saveButton}
      >
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">
            {t('dashboardCompanyAccessModeLabel')}
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {ACCESS_MODES.map((mode) => {
              const Icon = MODE_ICONS[mode];
              const checked = accessMode === mode;
              return (
                <label
                  key={mode}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40 has-focus-visible:ring-2 has-focus-visible:ring-ring',
                    checked && 'border-primary bg-primary/10',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon
                      className="size-4"
                      aria-hidden
                    />
                    <span className="flex-1">{t(`dashboardCompanyAccessMode_${mode}`)}</span>
                    <input
                      type="radio"
                      name="company-access-mode"
                      className="accent-(--primary)"
                      checked={checked}
                      onChange={() => setAccessMode(mode)}
                    />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`dashboardCompanyAccessModeHint_${mode}`)}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {accessMode === 'domain' ? (
          <div className="space-y-2">
            <label
              htmlFor="dashboard-company-domains"
              className="text-sm font-medium"
            >
              {t('dashboardCompanyDomainsLabel')}
            </label>
            <Input
              id="dashboard-company-domains"
              value={domainsText}
              onChange={(e) => setDomainsText(e.target.value)}
              className="font-mono"
              placeholder={t('dashboardCompanyDomainsPlaceholder')}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t('dashboardCompanyDomainsHint')}</p>
          </div>
        ) : null}

        {accessMode === 'invite' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              {t('dashboardCompanyInviteHint')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <PendingInvitationsButton
                accessToken={accessToken}
                size="sm"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={openInviteUserModal}
                className="inline-flex shrink-0 items-center gap-2"
              >
                <UserPlus
                  className="size-4"
                  aria-hidden
                />
                {t('inviteAction')}
              </Button>
            </div>
          </div>
        ) : null}
      </SettingsSection>
    </section>
  );
}
