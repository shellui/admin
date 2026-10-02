import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SearchField } from '@/features/email/components/SearchField';
import { emailErrorText } from '@/lib/emailApiErrors';
import type { EmailApiClient } from '@/lib/emailApi';
import { filterByQuery, listNeedsSearch, sectionTitle } from '@/lib/emailList';
import {
  nextRuleWrite,
  parseStaticRecipientLines,
  rulesForService,
  staticRecipientLines,
} from '@/lib/emailRules';
import type { EmailCatalogEvent, EmailRule } from '@/lib/emailTypes';
import type { WebhookServiceKey } from '@/lib/webhookServices';

type RowModel = {
  rule: EmailRule;
  label: string;
};

function RuleRow({
  row,
  templateKeys,
  busy,
  onSave,
}: {
  row: RowModel;
  templateKeys: string[];
  busy: boolean;
  onSave: (rule: EmailRule, body: ReturnType<typeof nextRuleWrite>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { rule } = row;
  const [templateKey, setTemplateKey] = useState(rule.templateKey);
  const [language, setLanguage] = useState(rule.language);
  const [recipientMode, setRecipientMode] = useState(rule.recipientMode);
  const [addresses, setAddresses] = useState(staticRecipientLines(rule.staticRecipients));

  useEffect(() => {
    setTemplateKey(rule.templateKey);
    setLanguage(rule.language);
    setRecipientMode(rule.recipientMode);
    setAddresses(staticRecipientLines(rule.staticRecipients));
  }, [rule]);

  const options = templateKeys.includes(templateKey)
    ? templateKeys
    : [templateKey, ...templateKeys];

  async function persist(enabled: boolean) {
    await onSave(
      rule,
      nextRuleWrite(rule, {
        enabled,
        templateKey,
        language,
        recipientMode,
        staticRecipients: parseStaticRecipientLines(addresses),
      }),
    );
  }

  return (
    <li className="space-y-3 rounded-md border border-border/80 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{row.label}</p>
          <p className="font-mono text-xs text-muted-foreground">{rule.eventType}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={rule.customized ? 'secondary' : 'muted'}>
            {rule.customized ? t('emailRuleCustom') : t('emailRuleSuggested')}
          </Badge>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              role="switch"
              aria-label={t('emailRuleToggle', { event: row.label })}
              checked={rule.enabled}
              disabled={busy}
              onChange={() => void persist(!rule.enabled)}
            />
            {rule.enabled ? t('emailEnabled') : t('emailDisabled')}
          </label>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t('emailRuleTemplate')}</span>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 font-mono text-xs"
            value={templateKey}
            aria-label={t('emailRuleTemplate')}
            onChange={(event) => setTemplateKey(event.target.value)}
          >
            {options.map((key) => (
              <option
                key={key}
                value={key}
              >
                {key}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t('emailRuleLanguage')}</span>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            value={language}
            aria-label={t('emailRuleLanguage')}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="">{t('emailRuleLanguageDefault')}</option>
            <option value="en">{t('emailLangEn')}</option>
            <option value="fr">{t('emailLangFr')}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t('emailRuleRecipients')}</span>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            value={recipientMode}
            aria-label={t('emailRuleRecipients')}
            onChange={(event) =>
              setRecipientMode(event.target.value === 'static' ? 'static' : 'hints')
            }
          >
            <option value="hints">{t('emailRuleModeHints')}</option>
            <option value="static">{t('emailRuleModeStatic')}</option>
          </select>
        </label>
      </div>
      {recipientMode === 'static' ? (
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">{t('emailRuleAddresses')}</span>
          <textarea
            className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm"
            value={addresses}
            aria-label={t('emailRuleAddresses')}
            onChange={(event) => setAddresses(event.target.value)}
          />
          <Text className="font-mono text-xs">{t('emailRuleAddressesHint')}</Text>
        </label>
      ) : (
        <Text className="font-mono text-xs">{t('emailRuleHintsHint')}</Text>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void persist(rule.enabled)}
      >
        {t('emailRuleSave')}
      </Button>
    </li>
  );
}

export function ServiceEmailRulesSection({
  service,
  client,
  canManage,
  signedIn,
}: {
  service: WebhookServiceKey;
  client: EmailApiClient | null;
  canManage: boolean;
  signedIn: boolean;
}) {
  const { t } = useTranslation();
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [catalog, setCatalog] = useState<EmailCatalogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState('');
  const [busyEvent, setBusyEvent] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client || !canManage) {
      setRules([]);
      setCatalog([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextRules, nextCatalog] = await Promise.all([
        client.fetchRules(),
        client.fetchCatalog(),
      ]);
      setRules(rulesForService(nextRules, service));
      setCatalog(nextCatalog.filter((event) => event.service === service));
    } catch (err) {
      setRules([]);
      setCatalog([]);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [canManage, client, service]);

  useEffect(() => {
    void load();
  }, [load]);

  const templateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const event of catalog) if (event.templateKey) keys.add(event.templateKey);
    return [...keys];
  }, [catalog]);

  const rows = useMemo<RowModel[]>(() => {
    const labels = new Map(catalog.map((event) => [event.eventType, event.label]));
    return rules.map((rule) => ({
      rule,
      label: labels.get(rule.eventType) || rule.eventType,
    }));
  }, [catalog, rules]);

  const visible = filterByQuery(
    rows,
    query,
    (row) => `${row.label} ${row.rule.eventType} ${row.rule.templateKey}`,
  );
  const title = sectionTitle(t('emailEventsSection'), visible.length);

  async function onSave(rule: EmailRule, body: ReturnType<typeof nextRuleWrite>) {
    if (!client) return;
    setBusyEvent(rule.eventType);
    setError(null);
    try {
      await client.saveRule(body);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusyEvent(null);
    }
  }

  return (
    <section
      className="space-y-3"
      aria-label={t('emailEventsSection')}
      data-email-service={service}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <Text>{t('emailEventsSectionHint')}</Text>
        </div>
        {listNeedsSearch(rows.length) ? (
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={t('emailEventsSearch')}
            label={t('emailEventsSearch')}
          />
        ) : null}
      </div>

      {signedIn && !canManage ? <Text>{t('emailForbidden')}</Text> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('emailLoading')}
        </div>
      ) : null}
      {error ? (
        <Text className="font-mono text-sm text-destructive">{emailErrorText(t, error)}</Text>
      ) : null}

      {!loading && canManage && client && visible.length === 0 ? (
        <Text>{t('emailEventsEmpty')}</Text>
      ) : null}

      <ul className="space-y-3">
        {visible.map((row) => (
          <RuleRow
            key={row.rule.eventType}
            row={row}
            templateKeys={templateKeys}
            busy={busyEvent === row.rule.eventType}
            onSave={onSave}
          />
        ))}
      </ul>
    </section>
  );
}
