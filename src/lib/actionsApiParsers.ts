import { unwrapResultsArray } from '@/lib/listResults';
import type {
  ActionDeliveriesListResponse,
  ActionDelivery,
  ActionDeliveryAttempt,
  ActionDeliveryDetail,
  ActionEventCatalogEntry,
  ActionRule,
  ActionRuleCreatePayload,
  ActionRuleEmailConfig,
  ActionRuleKind,
  ActionRuleUpdatePayload,
  ActionRuleWebhookConfig,
} from '@/features/actions/types';

function isoString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

function parseEmailConfig(cfg: Record<string, unknown>): ActionRuleEmailConfig {
  const recipients = Array.isArray(cfg.recipients)
    ? cfg.recipients.filter((r): r is string => typeof r === 'string')
    : undefined;
  return {
    ...(recipients ? { recipients } : {}),
    include_payload_email: cfg.include_payload_email === true,
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
  let rows: unknown[] | null = unwrapResultsArray(body);
  if (body && typeof body === 'object') {
    const root = body as Record<string, unknown>;
    if (rows == null && Array.isArray(root.events)) {
      rows = root.events;
    }
  }
  if (rows == null) {
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
  return {
    key,
    label: typeof o.label === 'string' ? o.label : undefined,
    description: typeof o.description === 'string' ? o.description : undefined,
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
    const cfg = payload.config as ActionRuleWebhookConfig;
    if (cfg.url !== undefined || !partial) out.url = cfg.url;
    if (cfg.secret?.trim()) out.secret = cfg.secret.trim();
    const auth = webhookAuthorizationHeader(cfg);
    if (auth) out.authorization_header = auth;
  }

  return out;
}
