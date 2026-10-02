import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { SearchField } from '@/features/email/components/SearchField';
import { useEmailApi } from '@/features/email/useEmailApi';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { emailErrorText } from '@/lib/emailApiErrors';
import { filterByQuery, listNeedsSearch, sectionTitle } from '@/lib/emailList';
import type { EmailCatalogEvent, EmailTemplateRow } from '@/lib/emailTypes';

const SERVICE_ORDER = ['identity', 'storage', 'hosting'];

function serviceLabelKey(
  service: string,
): 'webhooksServiceIdentity' | 'webhooksServiceStorage' | 'webhooksServiceHosting' | null {
  if (service === 'identity' || service === 'storage' || service === 'hosting') {
    if (service === 'identity') return 'webhooksServiceIdentity';
    if (service === 'storage') return 'webhooksServiceStorage';
    return 'webhooksServiceHosting';
  }
  return null;
}

export function EmailTemplatesPage() {
  const { t } = useTranslation();
  const accessToken = useShelluiAccessToken();
  const { api, baseUrl, canManage } = useEmailApi(accessToken);
  const [events, setEvents] = useState<EmailCatalogEvent[]>([]);
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!api || !canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [catalog, companyTemplates] = await Promise.all([
        api.fetchCatalog(),
        api.fetchTemplates(),
      ]);
      setEvents(catalog);
      setTemplates(companyTemplates);
    } catch (err) {
      setEvents([]);
      setTemplates([]);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [api, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const companyKeys = useMemo(() => new Set(templates.map((row) => row.templateKey)), [templates]);
  const visible = filterByQuery(
    events,
    query,
    (event) =>
      `${event.label} ${event.eventType} ${event.templateKey} ${event.suggested.en?.subject ?? ''} ${event.suggested.fr?.subject ?? ''}`,
  );

  const groups = useMemo(() => {
    const names = [...new Set(visible.map((event) => event.service))];
    names.sort((a, b) => {
      const ai = SERVICE_ORDER.indexOf(a);
      const bi = SERVICE_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
    });
    return names.map((service) => ({
      service,
      events: visible.filter((event) => event.service === service),
    }));
  }, [visible]);

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
      {listNeedsSearch(events.length) ? (
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t('emailTemplatesSearch')}
          label={t('emailTemplatesSearch')}
        />
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('emailLoading')}
        </div>
      ) : null}
      {error ? (
        <Text className="font-mono text-sm text-destructive">{emailErrorText(t, error)}</Text>
      ) : null}
      {!loading && canManage && visible.length === 0 ? (
        <Text>{t('emailTemplatesEmpty')}</Text>
      ) : null}

      {groups.map((group) => {
        const labelKey = serviceLabelKey(group.service);
        const label = labelKey ? t(labelKey) : group.service;
        return (
          <section
            key={group.service}
            className="space-y-3"
          >
            <h2 className="text-lg font-semibold tracking-tight">
              {sectionTitle(label, group.events.length)}
            </h2>
            <ul className="divide-y divide-border/80 rounded-md border border-border/80">
              {group.events.map((event) => {
                const company = companyKeys.has(event.templateKey);
                return (
                  <li
                    key={event.eventType}
                    className="flex flex-wrap items-start justify-between gap-3 px-3 py-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{event.label}</p>
                        <Badge variant={company ? 'secondary' : 'muted'}>
                          {company ? t('emailCompanyBadge') : t('emailSuggestedBadge')}
                        </Badge>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{event.eventType}</p>
                      <p className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground">
                          {t('emailLangEn')}:{' '}
                        </span>
                        {event.suggested.en?.subject || t('emailSubjectMissing')}
                      </p>
                      <p className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground">
                          {t('emailLangFr')}:{' '}
                        </span>
                        {event.suggested.fr?.subject || t('emailSubjectMissing')}
                      </p>
                    </div>
                    <Link
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      to={`/email/templates/${encodeURIComponent(event.templateKey)}`}
                    >
                      {t('emailEditTemplate')}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
