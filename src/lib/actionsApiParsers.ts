import { unwrapResultsArray } from '@/lib/listResults';
import type {
  ActionDeliveriesListResponse,
  ActionDelivery,
  ActionDeliveryAttempt,
  ActionDeliveryDetail,
  ActionEventCatalogEntry,
  ActionRule,
  ActionRuleCreatePayload,
  ActionRuleMutationResult,
  ActionRuleSendTestResult,
  ActionRuleUpdatePayload,
  ActionRuleWebhookConfig,
} from '@/features/actions/types';

function isoString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

function parseWebhookConfig(cfg: Record<string, unknown>): ActionRuleWebhookConfig {
  const has_secret = cfg.has_secret === true || cfg.secret_set === true;
  const secret_hint = typeof cfg.secret_hint === 'string' ? cfg.secret_hint : undefined;
  return {
    url: typeof cfg.url === 'string' ? cfg.url : '',
    ...(has_secret ? { has_secret: true } : {}),
    ...(secret_hint ? { secret_hint } : {}),
    secret_set: cfg.secret_set === true,
    authorization_header_set: cfg.authorization_header_set === true,
  };
}

function extractRevealedSecret(raw: Record<string, unknown>): string | undefined {
  const top = typeof raw.secret === 'string' ? raw.secret.trim() : '';
  if (top) return top;
  const configRaw = raw.config;
  if (configRaw && typeof configRaw === 'object') {
    const nested = (configRaw as Record<string, unknown>).secret;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return undefined;
}

export function parseIdentityRuleResponse(raw: unknown): ActionRuleMutationResult {
  const rule = parseIdentityRule(raw);
  if (!raw || typeof raw !== 'object') {
    return { rule };
  }
  const revealedSecret = extractRevealedSecret(raw as Record<string, unknown>);
  return revealedSecret ? { rule, revealedSecret } : { rule };
}

export function parseIdentityRule(raw: unknown): ActionRule {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Unexpected actions rule response.');
  }
  const o = raw as Record<string, unknown>;
  const actionKind = o.action_kind;
  if (actionKind != null && actionKind !== 'webhook') {
    throw new Error('Unexpected actions rule response.');
  }
  const configRaw =
    o.config && typeof o.config === 'object' ? (o.config as Record<string, unknown>) : {};
  return {
    id: typeof o.id === 'number' || typeof o.id === 'string' ? o.id : String(o.id ?? ''),
    name: typeof o.name === 'string' ? o.name : '',
    event:
      typeof o.event_type === 'string' ? o.event_type : typeof o.event === 'string' ? o.event : '',
    enabled: o.enabled !== false,
    config: parseWebhookConfig(configRaw),
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
  const sample_envelope =
    o.sample_envelope !== undefined && o.sample_envelope !== null ? o.sample_envelope : undefined;
  return {
    key,
    label: typeof o.label === 'string' ? o.label : undefined,
    description: typeof o.description === 'string' ? o.description : undefined,
    ...(sample_envelope !== undefined ? { sample_envelope } : {}),
  };
}

export function parseSendTestResult(body: unknown): ActionRuleSendTestResult {
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected send-test response.');
  }
  const o = body as Record<string, unknown>;
  const webhook_id = typeof o.webhook_id === 'string' ? o.webhook_id : '';
  const event_type = typeof o.event_type === 'string' ? o.event_type : '';
  if (!webhook_id) {
    throw new Error('Unexpected send-test response.');
  }
  return {
    ok: o.ok === true,
    webhook_id,
    event_type,
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
