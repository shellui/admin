import { parseEmailDocument, type EmailLang, type EmailVariable } from '@/lib/emailDocument';
import { EmailApiError } from '@/lib/emailApiErrors';
import type {
  EmailCatalogEvent,
  EmailCountBucket,
  EmailProviderSettings,
  EmailRenderResult,
  EmailRule,
  EmailStats,
  EmailTemplateDefaults,
  EmailTemplatePack,
  EmailTemplateRow,
  EmailTemplateVersion,
  EmailTestSendResult,
} from '@/lib/emailTypes';
import { EMAIL_COUNT_KEYS } from '@/lib/emailTypes';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function bool(value: unknown): boolean {
  return value === true;
}

function parseVariable(value: unknown): EmailVariable | null {
  const row = record(value);
  if (!row || typeof row.token !== 'string') return null;
  const allowedHostsSetting =
    typeof row.allowed_hosts_setting === 'string' ? row.allowed_hosts_setting.trim() : '';
  return {
    token: row.token,
    type: str(row.type) || 'string',
    required: bool(row.required),
    description: str(row.description),
    example: str(row.example),
    isUrl: bool(row.is_url) || str(row.type) === 'url',
    ...(allowedHostsSetting ? { allowedHostsSetting } : {}),
  };
}

function parseVariables(value: unknown): EmailVariable[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseVariable).filter((item): item is EmailVariable => item !== null);
}

export function parseCatalog(body: unknown): EmailCatalogEvent[] {
  const root = record(body);
  const events = root && Array.isArray(root.events) ? root.events : null;
  if (!events) throw new EmailApiError('request_failed', 200);
  return events.map((item) => {
    const row = record(item) ?? {};
    const suggestedRaw = record(row.suggested) ?? {};
    const suggested: EmailCatalogEvent['suggested'] = {};
    for (const lang of ['en', 'fr'] as const) {
      const pack = record(suggestedRaw[lang]);
      if (!pack) continue;
      suggested[lang] = { subject: str(pack.subject), preheader: str(pack.preheader) };
    }
    return {
      service: str(row.service),
      eventType: str(row.event_type),
      templateKey: str(row.template_key),
      label: str(row.label),
      laneClass: str(row.lane_class),
      defaultLane: str(row.default_lane),
      defaultEnabled: bool(row.default_enabled),
      category: str(row.category),
      defaultTtlSeconds:
        typeof row.default_ttl_seconds === 'number' ? row.default_ttl_seconds : null,
      variables: parseVariables(row.variables),
      suggested,
    };
  });
}

export function parseRules(body: unknown): EmailRule[] {
  const root = record(body);
  const rules = root && Array.isArray(root.rules) ? root.rules : null;
  if (!rules) throw new EmailApiError('request_failed', 200);
  return rules.map((item) => {
    const row = record(item) ?? {};
    const mode = row.recipient_mode === 'static' ? 'static' : 'hints';
    const staticRecipients = Array.isArray(row.static_recipients) ? row.static_recipients : [];
    return {
      eventType: str(row.event_type),
      service: str(row.service),
      templateKey: str(row.template_key),
      enabled: bool(row.enabled),
      language: str(row.language),
      recipientMode: mode,
      staticRecipients: staticRecipients.filter(
        (recipient): recipient is EmailRule['staticRecipients'][number] =>
          typeof recipient === 'string' ||
          (Boolean(record(recipient)) && typeof record(recipient)?.email === 'string'),
      ),
      customized: bool(row.customized),
      defaultEnabled: bool(row.default_enabled),
    };
  });
}

export function parseTemplates(body: unknown): EmailTemplateRow[] {
  const root = record(body);
  const templates = root && Array.isArray(root.templates) ? root.templates : null;
  if (!templates) throw new EmailApiError('request_failed', 200);
  return templates.map((item) => {
    const row = record(item) ?? {};
    return {
      id: num(row.id),
      templateKey: str(row.template_key),
      language: str(row.language),
      companyId: typeof row.company_id === 'number' ? row.company_id : null,
      activeVersion: typeof row.active_version === 'number' ? row.active_version : null,
    };
  });
}

export function parseVersions(body: unknown): EmailTemplateVersion[] {
  const root = record(body);
  const versions = root && Array.isArray(root.versions) ? root.versions : null;
  if (!versions) throw new EmailApiError('request_failed', 200);
  return versions.map((item) => {
    const row = record(item) ?? {};
    return {
      number: num(row.number),
      state: str(row.state),
      subject: str(row.subject),
      publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
    };
  });
}

function parsePack(value: unknown): EmailTemplatePack | null {
  const row = record(value);
  if (!row) return null;
  return {
    subject: str(row.subject),
    preheader: str(row.preheader),
    document: parseEmailDocument(row.document),
  };
}

export function parseTemplateDefaults(body: unknown): EmailTemplateDefaults {
  const root = record(body);
  if (!root) throw new EmailApiError('request_failed', 200);
  const languagesRaw = record(root.languages) ?? {};
  const languages: EmailTemplateDefaults['languages'] = {};
  for (const lang of ['en', 'fr'] as const) {
    const pack = parsePack(languagesRaw[lang]);
    if (pack) languages[lang] = pack;
  }
  return {
    templateKey: str(root.template_key),
    languages,
    variables: parseVariables(root.variables),
  };
}

export function parseProvider(body: unknown): EmailProviderSettings {
  const row = record(body);
  if (!row) throw new EmailApiError('request_failed', 200);
  return {
    companyId: typeof row.company_id === 'number' ? row.company_id : null,
    configured: bool(row.configured),
    provider: typeof row.provider === 'string' && row.provider ? row.provider : null,
    fromEmail: str(row.from_email),
    fromName: str(row.from_name),
    sendingDomain: str(row.sending_domain),
    bulkFromEmail: str(row.bulk_from_email),
    credentialsHint: str(row.credentials_hint),
    webhookConfigured: bool(row.webhook_configured),
    webhookHint: str(row.webhook_hint),
    fallbackProvider: str(row.fallback_provider),
    fallbackConfigured: bool(row.fallback_configured),
    smtpAllowed: row.smtp_allowed === true,
  };
}

function emptyBucket(): EmailCountBucket {
  return {
    sent: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    expired: 0,
    failed: 0,
    queued: 0,
    suppressed: 0,
    cancelled: 0,
  };
}

function parseBucket(value: unknown): EmailCountBucket {
  const row = record(value) ?? {};
  const bucket = emptyBucket();
  for (const key of EMAIL_COUNT_KEYS) bucket[key] = num(row[key]);
  return bucket;
}

export function parseStats(body: unknown): EmailStats {
  const root = record(body);
  if (!root) throw new EmailApiError('request_failed', 200);
  const byLane: Record<string, EmailCountBucket> = {};
  const laneRaw = record(root.by_lane) ?? {};
  for (const [lane, value] of Object.entries(laneRaw)) byLane[lane] = parseBucket(value);
  const byEvent: Record<string, EmailCountBucket> = {};
  const eventRaw = record(root.by_event) ?? {};
  for (const [eventType, value] of Object.entries(eventRaw))
    byEvent[eventType] = parseBucket(value);
  const byDay = Array.isArray(root.by_day)
    ? root.by_day.map((item) => {
        const row = record(item) ?? {};
        return { day: str(row.day), ...parseBucket(row) };
      })
    : [];
  const skippedRaw = record(root.skipped) ?? {};
  return {
    companyId: typeof root.company_id === 'number' ? root.company_id : null,
    from: str(root.from),
    to: str(root.to),
    totals: parseBucket(root.totals),
    skipped: {
      total: num(skippedRaw.total),
      noRecipients: num(skippedRaw.no_recipients),
      ruleDisabled: num(skippedRaw.rule_disabled),
    },
    byLane,
    byEvent,
    byDay,
  };
}

export function parseRender(body: unknown): EmailRenderResult {
  const row = record(body);
  if (!row) throw new EmailApiError('request_failed', 200);
  return {
    subject: str(row.subject),
    html: str(row.html),
    text: str(row.text),
    missingVariables: Array.isArray(row.missing_variables)
      ? row.missing_variables.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

export function parseTestSend(body: unknown): EmailTestSendResult {
  const row = record(body);
  if (!row) throw new EmailApiError('request_failed', 200);
  return {
    status: str(row.status),
    provider: str(row.provider),
    providerMessageId: str(row.provider_message_id),
  };
}

export function isEmailLang(value: string): value is EmailLang {
  return value === 'en' || value === 'fr';
}
