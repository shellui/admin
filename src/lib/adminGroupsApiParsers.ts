export type AdminGroupSource = 'manual' | 'scim';

export type AdminGroupRow = {
  id: number;
  display_name: string;
  source: AdminGroupSource;
  user_count: number;
};

const FIELD_LABELS: Record<string, string> = {
  display_name: 'Display name',
  name: 'Name',
};

function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatFieldError(key: string, message: string): string {
  const label = fieldLabel(key);
  const trimmed = message.trim();
  if (trimmed === 'This field is required.') {
    return `${label} is required.`;
  }
  if (/^[A-Z]/.test(trimmed) && trimmed.length > 24 && !trimmed.includes('_')) {
    return trimmed;
  }
  return `${label}: ${trimmed}`;
}

export function parseGroupsApiErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === 'string') return o.detail;
  if (typeof o.error === 'string') return o.error;

  const parts: string[] = [];
  for (const [key, value] of Object.entries(o)) {
    if (key === 'detail' || key === 'error') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') parts.push(formatFieldError(key, item));
      }
    } else if (typeof value === 'string') {
      parts.push(formatFieldError(key, value));
    }
  }
  if (parts.length) return parts.join(' ');

  const firstKey = Object.keys(o)[0];
  const v = firstKey ? o[firstKey] : null;
  if (Array.isArray(v) && typeof v[0] === 'string') return formatFieldError(firstKey, v[0]);
  if (typeof v === 'string') return formatFieldError(firstKey, v);
  return null;
}

export function parseAdminGroupRow(raw: unknown): AdminGroupRow {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid group row');
  }
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'number' ? o.id : Number(o.id);
  if (!Number.isFinite(id)) {
    throw new Error('Invalid group row');
  }
  const display_name =
    typeof o.display_name === 'string' ? o.display_name : typeof o.name === 'string' ? o.name : '';
  const source: AdminGroupSource = o.source === 'scim' ? 'scim' : 'manual';
  const user_count =
    typeof o.user_count === 'number'
      ? o.user_count
      : typeof o.user_count === 'string'
        ? Number(o.user_count)
        : 0;

  return {
    id,
    display_name,
    source,
    user_count: Number.isFinite(user_count) ? user_count : 0,
  };
}

export function parseAdminGroupsList(body: unknown): AdminGroupRow[] {
  if (!Array.isArray(body)) {
    throw new Error('Invalid groups list');
  }
  return body.map((row) => parseAdminGroupRow(row));
}
