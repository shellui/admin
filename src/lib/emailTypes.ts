import type { EmailDocument, EmailLang, EmailVariable } from '@/lib/emailDocument';

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
  suggested: Partial<Record<EmailLang, { subject: string; preheader: string }>>;
};

export type EmailRecipientMode = 'hints' | 'static';

export type EmailStaticRecipient = string | { email: string; user_id?: number };

export type EmailRule = {
  eventType: string;
  service: string;
  templateKey: string;
  enabled: boolean;
  language: string;
  recipientMode: EmailRecipientMode;
  staticRecipients: EmailStaticRecipient[];
  customized: boolean;
  defaultEnabled: boolean;
};

export type EmailRuleWrite = {
  event_type: string;
  enabled: boolean;
  template_key: string;
  language: string;
  recipient_mode: EmailRecipientMode;
  static_recipients: string[];
};

export type EmailTemplateRow = {
  id: number;
  templateKey: string;
  language: string;
  companyId: number | null;
  activeVersion: number | null;
};

export type EmailTemplateVersion = {
  number: number;
  state: string;
  subject: string;
  preheader: string;
  document: EmailDocument;
  themeName: string;
  /** `{}` means the Shellui palette. Otherwise the seven `#RRGGBB` keys. */
  themePalette: Record<string, string>;
  publishedAt: string | null;
};

export type EmailTemplatePack = {
  subject: string;
  preheader: string;
  document: EmailDocument;
};

export type EmailTemplateDefaults = {
  templateKey: string;
  languages: Partial<Record<EmailLang, EmailTemplatePack>>;
  variables: EmailVariable[];
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

export type EmailRenderResult = {
  subject: string;
  html: string;
  text: string;
  missingVariables: string[];
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
