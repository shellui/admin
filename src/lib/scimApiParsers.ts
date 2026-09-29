import { unwrapResultsArray } from '@/lib/listResults';

export type ScimTokenRow = {
  id: string;
  label: string;
  token_prefix: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  is_active: boolean;
};

export type ScimTokenCreateResponse = ScimTokenRow & {
  token: string;
};

function isoString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function parseScimTokenRow(raw: unknown): ScimTokenRow {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Unexpected SCIM token row.');
  }
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    label: typeof o.name === 'string' ? o.name : typeof o.label === 'string' ? o.label : '',
    token_prefix: typeof o.token_prefix === 'string' ? o.token_prefix : '',
    created_at: isoString(o.created_at),
    revoked_at: o.revoked_at == null ? null : isoString(o.revoked_at),
    last_used_at: o.last_used_at == null ? null : isoString(o.last_used_at),
    is_active: o.is_active !== false && o.revoked_at == null,
  };
}

export function parseScimTokensList(body: unknown): ScimTokenRow[] {
  const rows = unwrapResultsArray(body);
  if (rows == null) {
    throw new Error('Unexpected SCIM tokens response.');
  }
  return rows.map(parseScimTokenRow);
}

export function parseScimTokenCreate(body: unknown): ScimTokenCreateResponse {
  const row = parseScimTokenRow(body);
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected SCIM token create response.');
  }
  const token = (body as Record<string, unknown>).token;
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Unexpected SCIM token create response.');
  }
  return { ...row, token };
}
