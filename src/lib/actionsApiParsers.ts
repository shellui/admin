import { isJsonContent } from '@/lib/actionEmailDefaults';
import { unwrapResultsArray } from '@/lib/listResults';
import type {
  ActionDeliveriesListResponse,
  ActionDelivery,
  ActionDeliveryAttempt,
  ActionDeliveryDetail,
  ActionEmailTemplate,
  ActionEventCatalogEntry,
  ActionRule,
  ActionRuleCreatePayload,
  ActionRuleEmailConfig,
  ActionRuleKind,
  ActionRuleUpdatePayload,
  ActionRuleWebhookConfig,
  ActionTemplateVariable,
} from '@/features/actions/types';

const DEFAULT_ENVELOPE_TEMPLATE_VARIABLES: ActionTemplateVariable[] = [
  { token: 'envelope.id', description: 'Unique delivery envelope id' },
  { token: 'envelope.type', description: 'Event type id' },
  { token: 'envelope.time', description: 'Event timestamp (ISO 8601)' },
  { token: 'envelope.company.id', description: 'Company id' },
  { token: 'envelope.company.slug', description: 'Company slug' },
  { token: 'envelope.company.name', description: 'Company display name' },
];

function parseFieldDocArray(raw: unknown): Array<{ name: string; description?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const o = item as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) return [];
    return [
      {
        name,
        description: typeof o.description === 'string' ? o.description : undefined,
      },
    ];
  });
}

function dataToken(fieldName: string): string {
  const trimmed = fieldName.trim().replace(/^data\./, '');
  return `data.${trimmed}`;
}

export function isUrlLikeTemplateField(name: string, description?: string): boolean {
  const blob = `${name} ${description ?? ''}`.toLowerCase();
  return (
    /(?:^|[_.-])(?:url|link|href)(?:$|[_.-])/.test(blob) ||
    blob.includes('magic link') ||
    blob.includes('sign-in url') ||
    blob.includes('sign in url')
  );
}

/** Build deduplicated Django template paths for TipTap placeholder chips. */
export function buildEventTemplateVariables(
  raw: Record<string, unknown>,
): ActionTemplateVariable[] {
  const byToken = new Map<string, ActionTemplateVariable>();

  const add = (token: string, description?: string, opts?: { isUrl?: boolean }) => {
    const normalized = token.trim();
    if (!normalized) return;
    const isUrl = opts?.isUrl ?? isUrlLikeTemplateField(normalized, description);
    const prev = byToken.get(normalized);
    if (prev) {
      if (description && !prev.description) prev.description = description;
      if (isUrl) prev.isUrl = true;
      return;
    }
    byToken.set(normalized, {
      token: normalized,
      description,
      ...(isUrl ? { isUrl: true } : {}),
    });
  };

  const fieldGroups: unknown[] = [
    raw.payload_fields,
    raw.email_template_fields,
    raw.email_context_fields,
    raw.envelope_fields,
  ];
  for (const group of fieldGroups) {
    for (const field of parseFieldDocArray(group)) {
      if (field.name.startsWith('envelope.')) {
        add(field.name, field.description);
      } else if (field.name.startsWith('data.')) {
        add(field.name, field.description);
      } else {
        add(dataToken(field.name), field.description);
      }
    }
  }

  const payloadEmail =
    typeof raw.payload_email_field === 'string' ? raw.payload_email_field.trim() : '';
  if (payloadEmail) {
    add(payloadEmail.includes('.') ? payloadEmail : dataToken(payloadEmail));
  }

  for (const env of DEFAULT_ENVELOPE_TEMPLATE_VARIABLES) {
    add(env.token, env.description);
  }

  return [...byToken.values()].sort((a, b) => a.token.localeCompare(b.token));
}

function isoString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

function mapEmailTemplatesFromIdentity(raw: unknown): ActionRuleEmailConfig['email_templates'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: NonNullable<ActionRuleEmailConfig['email_templates']> = {};
  for (const [lang, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (lang !== 'en' && lang !== 'fr') continue;
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const html =
      typeof e.html === 'string' ? e.html : typeof e.body_html === 'string' ? e.body_html : '';
    const document = isJsonContent(e.document) ? e.document : undefined;
    out[lang] = {
      subject: typeof e.subject === 'string' ? e.subject : '',
      html,
      ...(document ? { document } : {}),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

function mapEmailTemplatesToIdentity(
  templates: ActionRuleEmailConfig['email_templates'],
): Record<string, { subject: string; html: string; document?: unknown }> | undefined {
  if (!templates) return undefined;
  const out: Record<string, { subject: string; html: string; document?: unknown }> = {};
  for (const lang of ['en', 'fr'] as const) {
    const t = templates[lang];
    if (!t) continue;
    out[lang] = {
      subject: t.subject,
      html: t.html,
      ...(t.document ? { document: t.document } : {}),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

function parseEmailConfig(cfg: Record<string, unknown>): ActionRuleEmailConfig {
  const recipients = Array.isArray(cfg.recipients)
    ? cfg.recipients.filter((r): r is string => typeof r === 'string')
    : [];
  return {
    recipients,
    include_payload_email: cfg.include_payload_email === true,
    email_templates: mapEmailTemplatesFromIdentity(cfg.email_templates),
  };
}

function parseWebhookConfig(cfg: Record<string, unknown>): ActionRuleWebhookConfig {
  return {
    url: typeof cfg.url === 'string' ? cfg.url : '',
    secret_set: cfg.secret_set === true,
    authorization_header_set: cfg.authorization_header_set === true,
  };
}

export function parseIdentityRule(raw: unknown): ActionRule {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Unexpected actions rule response.');
  }
  const o = raw as Record<string, unknown>;
  const kind: ActionRuleKind = o.action_kind === 'webhook' ? 'webhook' : 'email';
  const configRaw =
    o.config && typeof o.config === 'object' ? (o.config as Record<string, unknown>) : {};
  return {
    id: typeof o.id === 'number' || typeof o.id === 'string' ? o.id : String(o.id ?? ''),
    name: typeof o.name === 'string' ? o.name : '',
    event:
      typeof o.event_type === 'string' ? o.event_type : typeof o.event === 'string' ? o.event : '',
    kind,
    enabled: o.enabled !== false,
    config: kind === 'webhook' ? parseWebhookConfig(configRaw) : parseEmailConfig(configRaw),
    created_at: isoString(o.created_at),
    updated_at: isoString(o.updated_at),
  };
}

export function parseRulesList(body: unknown): ActionRule[] {
  const rows = unwrapResultsArray(body);
  if (rows == null) {
    throw new Error('Unexpected actions rules response.');
  }
  return rows.map(parseIdentityRule);
}

export function parseEventsList(body: unknown): ActionEventCatalogEntry[] {
  const rows = unwrapResultsArray(body);
  if (rows == null) {
    if (body && typeof body === 'object') {
      const events = (body as Record<string, unknown>).events;
      if (Array.isArray(events)) {
        return events.map(parseEventEntry);
      }
    }
    throw new Error('Unexpected actions events response.');
  }
  return rows.map(parseEventEntry);
}

function parseEventEntry(raw: unknown): ActionEventCatalogEntry {
  if (!raw || typeof raw !== 'object') {
    return { key: '' };
  }
  const o = raw as Record<string, unknown>;
  const key = typeof o.type === 'string' ? o.type : typeof o.key === 'string' ? o.key : '';
  const payloadField = typeof o.payload_email_field === 'string' ? o.payload_email_field : null;
  const template_variables = buildEventTemplateVariables(o);
  return {
    key,
    label: typeof o.label === 'string' ? o.label : undefined,
    description: typeof o.description === 'string' ? o.description : undefined,
    payload_email_field: payloadField,
    template_variables: template_variables.length ? template_variables : undefined,
  };
}

export function parseEmailTemplate(body: unknown): ActionEmailTemplate {
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected email template response.');
  }
  const o = body as Record<string, unknown>;
  const html =
    typeof o.html === 'string' ? o.html : typeof o.body_html === 'string' ? o.body_html : '';
  const document = isJsonContent(o.document) ? o.document : undefined;
  return {
    subject: typeof o.subject === 'string' ? o.subject : '',
    html,
    ...(document ? { document } : {}),
  };
}

function parseDeliveryRow(raw: unknown): ActionDelivery {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Unexpected delivery row.');
  }
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    status: typeof o.status === 'string' ? o.status : 'unknown',
    event:
      typeof o.event_type === 'string' ? o.event_type : typeof o.event === 'string' ? o.event : '',
    rule_id:
      typeof o.action_rule_id === 'number' || typeof o.action_rule_id === 'string'
        ? o.action_rule_id
        : typeof o.rule_id === 'number' || typeof o.rule_id === 'string'
          ? o.rule_id
          : '',
    rule_name:
      typeof o.action_rule_name === 'string'
        ? o.action_rule_name
        : typeof o.rule_name === 'string'
          ? o.rule_name
          : undefined,
    attempts_count:
      typeof o.attempt_count === 'number'
        ? o.attempt_count
        : typeof o.attempts_count === 'number'
          ? o.attempts_count
          : 0,
    created_at: isoString(o.created_at),
    updated_at: isoString(o.updated_at),
    last_error:
      typeof o.last_error === 'string'
        ? o.last_error
        : o.last_error == null
          ? null
          : String(o.last_error),
  };
}

function parseAttemptRow(raw: unknown): ActionDeliveryAttempt {
  if (!raw || typeof raw !== 'object') {
    return { id: '', status: 'unknown', created_at: '' };
  }
  const o = raw as Record<string, unknown>;
  return {
    id: typeof o.id === 'number' || typeof o.id === 'string' ? o.id : String(o.id ?? ''),
    status: typeof o.status === 'string' ? o.status : 'unknown',
    created_at: isoString(o.created_at),
    error:
      typeof o.error_message === 'string'
        ? o.error_message
        : typeof o.error === 'string'
          ? o.error
          : null,
    response_status:
      typeof o.http_status === 'number'
        ? o.http_status
        : typeof o.response_status === 'number'
          ? o.response_status
          : null,
  };
}

export function parseDeliveriesList(body: unknown): ActionDeliveriesListResponse {
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected deliveries response.');
  }
  const o = body as Record<string, unknown>;
  const rawResults = Array.isArray(o.results) ? o.results : (unwrapResultsArray(body) ?? []);
  const results = rawResults.map(parseDeliveryRow);
  const count = typeof o.count === 'number' ? o.count : results.length;
  return { count, results };
}

export function parseDeliveryDetail(body: unknown): ActionDeliveryDetail {
  const base = parseDeliveryRow(body);
  if (!body || typeof body !== 'object') {
    return { ...base, attempts: [] };
  }
  const o = body as Record<string, unknown>;
  const attempts = Array.isArray(o.attempts) ? o.attempts.map(parseAttemptRow) : [];
  const payload = o.envelope ?? o.payload;
  return { ...base, attempts, payload };
}

function webhookAuthorizationHeader(cfg: ActionRuleWebhookConfig): string | undefined {
  const value = cfg.auth_header_value?.trim();
  if (!value) return undefined;
  const name = cfg.auth_header_name?.trim();
  if (name && !value.toLowerCase().startsWith(name.toLowerCase())) {
    return `${name}: ${value}`;
  }
  return value;
}

export function toIdentityRuleWriteBody(
  payload: ActionRuleCreatePayload | ActionRuleUpdatePayload,
  options?: { partial?: boolean },
): Record<string, unknown> {
  const partial = options?.partial === true;
  const out: Record<string, unknown> = {};

  if (payload.name !== undefined) out.name = payload.name;
  if (payload.event !== undefined) out.event_type = payload.event;
  if (payload.kind !== undefined) out.action_kind = payload.kind;
  if (payload.enabled !== undefined) out.enabled = payload.enabled;

  if (payload.config) {
    if (payload.kind === 'webhook' || (!payload.kind && 'url' in payload.config)) {
      const cfg = payload.config as ActionRuleWebhookConfig;
      if (cfg.url !== undefined || !partial) out.url = cfg.url;
      if (cfg.secret?.trim()) out.secret = cfg.secret.trim();
      const auth = webhookAuthorizationHeader(cfg);
      if (auth) out.authorization_header = auth;
    } else {
      const cfg = payload.config as ActionRuleEmailConfig;
      if (cfg.recipients !== undefined || !partial) out.recipients = cfg.recipients;
      if (cfg.include_payload_email !== undefined || !partial) {
        out.include_payload_email = cfg.include_payload_email ?? false;
      }
      const templates = mapEmailTemplatesToIdentity(cfg.email_templates);
      if (templates) out.email_templates = templates;
    }
  }

  return out;
}
