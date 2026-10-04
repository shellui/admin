import type { EmailDocument, EmailLang, EmailVariable } from '@/lib/emailDocument';
import type { EmailTranslations } from '@/lib/emailTranslations';

export type EmailCatalogEvent = {
  service: string;
  eventType: string;
  templateKey: string;
  label: string;
  laneClass: string;
  defaultLane: string;
  defaultEnabled: boolean;
  category: string;
  defaultTtlSeconds: number | null;
  variables: EmailVariable[];
  /** URL variable a library design's `{{ action_url }}` becomes. Empty when the event has none. */
  linkToken: string;
  /** Library key copied for built-in rules and direct sends. */
  defaultTemplate: string;
  suggested: Partial<Record<EmailLang, { subject: string; preheader: string }>>;
};

export type EmailRecipientMode = 'hints' | 'static';

export type EmailStaticRecipient = string | { email: string; user_id?: number };

export type EmailRule = {
  id: number;
  service: string;
  eventType: string;
  enabled: boolean;
  recipientMode: EmailRecipientMode;
  staticRecipients: string[];
  language: string;
  templateId: number;
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmailRuleContent = { library_id: number };

export type EmailRuleCreate = {
  event_type: string;
  service?: string;
  enabled?: boolean;
  language: string;
  recipient_mode: EmailRecipientMode;
  static_recipients: string[];
  content: EmailRuleContent;
};

export type EmailRulePatch = {
  enabled?: boolean;
  recipient_mode?: EmailRecipientMode;
  static_recipients?: string[];
  language?: string;
};

export type EmailTemplateRow = {
  id: number;
  templateKey: string;
  name: string;
  eventType: string;
  language: string;
  companyId: number | null;
  activeVersion: number | null;
  /** Library key the copy started from. */
  sourceKey: string;
  set: string;
  /** Read-only fonts and mobile rules of the design's set. */
  head: string;
};

export type EmailLibrarySet = {
  key: string;
  name: string;
};

export type EmailLibraryTemplate = {
  id: number;
  key: string;
  /** Empty for a blank company template. */
  set: string;
  name: string;
  builtIn: boolean;
  companyId: number | null;
  subject: string;
  preheader: string;
  updatedAt: string | null;
  html: string;
};

export type EmailLibraryDetail = EmailLibraryTemplate & {
  document: EmailDocument;
  text: string;
  head: string;
  variables: EmailVariable[];
};

export type EmailLibrary = {
  sets: EmailLibrarySet[];
  templates: EmailLibraryTemplate[];
};

export type EmailLibraryWrite = {
  name?: string;
  source_id?: number;
  subject?: string;
  preheader?: string;
  document?: EmailDocument;
};

export type EmailTemplateVersion = {
  number: number;
  state: string;
  subject: string;
  preheader: string;
  document: EmailDocument;
  /** Other languages of a copy: same layout, their own text. */
  translations: EmailTranslations;
  publishedAt: string | null;
};

export type EmailCatalog = {
  events: EmailCatalogEvent[];
  authLinkHosts: string[];
};

export type EmailProviderSettings = {
  companyId: number | null;
  configured: boolean;
  provider: string | null;
  fromEmail: string;
  fromName: string;
  sendingDomain: string;
  bulkFromEmail: string;
  credentialsHint: string;
  webhookConfigured: boolean;
  webhookHint: string;
  fallbackProvider: string;
  fallbackConfigured: boolean;
  /** `EMAIL_ALLOW_COMPANY_SMTP`. False hides company SMTP. */
  smtpAllowed: boolean;
  /** Read-only `EMAIL_AUTH_LINK_HOSTS`. */
  authLinkHosts: string[];
};

export type EmailProviderWrite = {
  provider: string;
  from_email: string;
  from_name?: string;
  sending_domain?: string;
  bulk_from_email?: string;
  credentials?: Record<string, unknown>;
};

export type EmailTestSendResult = {
  status: string;
  provider: string;
  providerMessageId: string;
};

export type EmailCountBucket = {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  expired: number;
  failed: number;
  queued: number;
  suppressed: number;
  cancelled: number;
};

export type EmailSkipped = {
  total: number;
  noRecipients: number;
  ruleDisabled: number;
};

export type EmailStats = {
  companyId: number | null;
  from: string;
  to: string;
  totals: EmailCountBucket;
  skipped: EmailSkipped;
  byLane: Record<string, EmailCountBucket>;
  byEvent: Record<string, EmailCountBucket>;
  byDay: Array<EmailCountBucket & { day: string }>;
};

export const EMAIL_COUNT_KEYS = [
  'sent',
  'delivered',
  'bounced',
  'complained',
  'expired',
  'failed',
  'queued',
  'suppressed',
  'cancelled',
] as const;
