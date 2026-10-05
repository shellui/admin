import { EmailApiError } from '@/lib/emailApiErrors';
import type { EmailCatalogEvent } from '@/lib/emailTypes';

/** What broadcast content may use, in the shape the editor reads from catalog events. */
export const BROADCAST_EVENT: EmailCatalogEvent = {
  service: '',
  eventType: '',
  templateKey: 'broadcast',
  label: 'Broadcast',
  laneClass: 'bulk',
  defaultLane: 'bulk',
  defaultEnabled: false,
  category: 'bulk',
  defaultTtlSeconds: null,
  variables: [
    {
      token: 'company_name',
      type: 'string',
      required: false,
      description: '',
      example: 'Acme',
      isUrl: false,
    },
    {
      token: 'first_name',
      type: 'string',
      required: false,
      description: '',
      example: 'Ada',
      isUrl: false,
    },
    {
      token: 'last_name',
      type: 'string',
      required: false,
      description: '',
      example: 'Lovelace',
      isUrl: false,
    },
    {
      token: 'recipient_email',
      type: 'string',
      required: false,
      description: '',
      example: 'ada@example.com',
      isUrl: false,
    },
  ],
  linkToken: '',
  defaultTemplate: '',
  suggested: {},
};

export type BroadcastState = 'draft' | 'queued' | 'preparing' | 'sending' | 'sent' | 'failed';
export type BroadcastDelivery = 'resend' | 'bulk_lane' | '';
export type BroadcastRole = 'owner' | 'staff' | 'member';
export type BroadcastAccess = 'enabled' | 'disabled' | 'any';

export const BROADCAST_ROLES: BroadcastRole[] = ['owner', 'staff', 'member'];
export const BROADCAST_ACCESS: BroadcastAccess[] = ['enabled', 'disabled', 'any'];

/** `filter`: members matching every filter. `pick`: chosen users and pasted addresses. */
export type BroadcastAudience = {
  mode: 'filter' | 'pick';
  group_ids: number[];
  roles: BroadcastRole[];
  access: BroadcastAccess;
  joined_after: string;
  joined_before: string;
  seen_after: string;
  seen_before: string;
  user_ids: number[];
  emails: string[];
};

export const BROADCAST_COUNT_KEYS = [
  'pending',
  'queued',
  'sent',
  'delivered',
  'bounced',
  'complained',
  'failed',
  'skipped_unsubscribed',
  'skipped_suppressed',
] as const;

export type BroadcastCountKey = (typeof BROADCAST_COUNT_KEYS)[number];
export type BroadcastCounts = Record<BroadcastCountKey, number> & { total: number };

export type BroadcastSender = {
  fromEmail: string;
  fromName: string;
  delivery: BroadcastDelivery;
  /** Why the company cannot send broadcasts yet, e.g. `bulk_sender_required`. */
  errorCode: string;
};

export type Broadcast = {
  id: number;
  name: string;
  state: BroadcastState;
  delivery: BroadcastDelivery;
  fromEmail: string;
  templateId: number;
  templateVersion: number | null;
  language: string;
  audience: BroadcastAudience;
  /** Null for a draft. */
  counts: BroadcastCounts | null;
  lastErrorCode: string;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  /** Only on detail responses. */
  sender: BroadcastSender | null;
};

export type BroadcastPreview = {
  total: number;
  sendable: number;
  unsubscribed: number;
  suppressed: number;
  /** Recipients per send language. */
  languages: Record<string, number>;
  samples: string[];
};

export type BroadcastCreate = {
  name: string;
  source_key: string;
  language: string;
  audience?: BroadcastAudience;
};

export type BroadcastPatch = {
  name?: string;
  audience?: BroadcastAudience;
};

export function emailBroadcastPath(id: number): string {
  return `/email/broadcasts/${id}`;
}

export function emptyAudience(): BroadcastAudience {
  return {
    mode: 'filter',
    group_ids: [],
    roles: [],
    access: 'enabled',
    joined_after: '',
    joined_before: '',
    seen_after: '',
    seen_before: '',
    user_ids: [],
    emails: [],
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function ids(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number' && item > 0);
}

const STATES: BroadcastState[] = ['draft', 'queued', 'preparing', 'sending', 'sent', 'failed'];

function delivery(value: unknown): BroadcastDelivery {
  return value === 'resend' || value === 'bulk_lane' ? value : '';
}

export function parseAudience(value: unknown): BroadcastAudience {
  const row = record(value) ?? {};
  const base = emptyAudience();
  return {
    mode: row.mode === 'pick' ? 'pick' : 'filter',
    group_ids: ids(row.group_ids),
    roles: Array.isArray(row.roles)
      ? row.roles.filter((role): role is BroadcastRole =>
          BROADCAST_ROLES.includes(role as BroadcastRole),
        )
      : [],
    access: BROADCAST_ACCESS.includes(row.access as BroadcastAccess)
      ? (row.access as BroadcastAccess)
      : base.access,
    joined_after: str(row.joined_after),
    joined_before: str(row.joined_before),
    seen_after: str(row.seen_after),
    seen_before: str(row.seen_before),
    user_ids: ids(row.user_ids),
    emails: Array.isArray(row.emails)
      ? row.emails.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function parseCounts(value: unknown): BroadcastCounts | null {
  const row = record(value);
  if (!row) return null;
  const counts = { total: num(row.total) } as BroadcastCounts;
  for (const key of BROADCAST_COUNT_KEYS) counts[key] = num(row[key]);
  return counts;
}

function parseSender(value: unknown): BroadcastSender | null {
  const row = record(value);
  if (!row) return null;
  return {
    fromEmail: str(row.from_email),
    fromName: str(row.from_name),
    delivery: delivery(row.delivery),
    errorCode: str(row.error_code),
  };
}

export function parseBroadcast(body: unknown): Broadcast {
  const row = record(body);
  if (!row || typeof row.id !== 'number') throw new EmailApiError('request_failed', 200);
  return {
    id: row.id,
    name: str(row.name),
    state: STATES.includes(row.state as BroadcastState) ? (row.state as BroadcastState) : 'draft',
    delivery: delivery(row.delivery),
    fromEmail: str(row.from_email),
    templateId: num(row.template_id),
    templateVersion: typeof row.template_version === 'number' ? row.template_version : null,
    language: str(row.language) || 'en',
    audience: parseAudience(row.audience),
    counts: parseCounts(row.counts),
    lastErrorCode: str(row.last_error_code),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    sentAt: typeof row.sent_at === 'string' ? row.sent_at : null,
    sender: parseSender(row.sender),
  };
}

export function parseBroadcasts(body: unknown): Broadcast[] {
  const root = record(body);
  if (!root || !Array.isArray(root.broadcasts)) throw new EmailApiError('request_failed', 200);
  return root.broadcasts.map(parseBroadcast);
}

export function parseBroadcastPreview(body: unknown): BroadcastPreview {
  const row = record(body);
  if (!row) throw new EmailApiError('request_failed', 200);
  const languages: Record<string, number> = {};
  for (const [language, count] of Object.entries(record(row.languages) ?? {})) {
    languages[language] = num(count);
  }
  return {
    total: num(row.total),
    sendable: num(row.sendable),
    unsubscribed: num(row.unsubscribed),
    suppressed: num(row.suppressed),
    languages,
    samples: Array.isArray(row.samples)
      ? row.samples.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

export function broadcastIsActive(broadcast: Broadcast): boolean {
  return (
    broadcast.state === 'queued' || broadcast.state === 'preparing' || broadcast.state === 'sending'
  );
}

/** True when the sender's domain has more labels than `name.tld`, e.g. `news.acme.com`. */
export function senderOnSubdomain(fromEmail: string): boolean {
  const domain = fromEmail.split('@')[1] ?? '';
  return domain.split('.').filter(Boolean).length > 2;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Addresses from pasted text, split on commas, semicolons, and whitespace. */
export function parsePastedEmails(text: string): { emails: string[]; invalid: string[] } {
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(/[\s,;]+/)) {
    const email = part.trim();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) {
      invalid.push(email);
      continue;
    }
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }
  return { emails, invalid };
}
