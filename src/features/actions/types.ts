import type { ActionEmailDocument } from '@/features/actions/emailDocument';

export type ActionRuleKind = 'email' | 'webhook';

export type ActionRuleId = string | number;

export type ActionTemplateVariable = {
  token: string;
  description?: string;
  /** Catalog example from identity — used for HTML preview substitution. */
  example?: unknown;
  isUrl?: boolean;
};

export type ActionEmailPreviewContext = {
  envelope?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

export type ActionEventCatalogEntry = {
  key: string;
  label?: string;
  description?: string;
  template_variables?: ActionTemplateVariable[];
  /** Ready-made `{ envelope, data }` from identity (preferred for preview). */
  sample_context?: ActionEmailPreviewContext | null;
  payload_email_field?: string | null;
};

export type ActionEmailTemplate = {
  subject: string;
  html: string;
  document?: ActionEmailDocument;
  /** Maps to Shellui appearance light/dark email styling (`shellui-light` | `shellui-dark`). */
  theme_id?: string;
};

export type ActionRuleEmailConfig = {
  recipients: string[];
  include_payload_email?: boolean;
  email_templates?: Partial<Record<'en' | 'fr', ActionEmailTemplate>>;
};

export type ActionRuleWebhookConfig = {
  url: string;
  secret?: string;
  auth_header_name?: string;
  auth_header_value?: string;
  secret_set?: boolean;
  authorization_header_set?: boolean;
};

export type ActionRule = {
  id: ActionRuleId;
  name: string;
  event: string;
  kind: ActionRuleKind;
  enabled: boolean;
  config: ActionRuleEmailConfig | ActionRuleWebhookConfig;
  created_at: string;
  updated_at: string;
};

export type ActionDeliveryStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'dead'
  | string;

export type ActionDelivery = {
  id: string;
  status: ActionDeliveryStatus;
  event: string;
  rule_id: ActionRuleId;
  rule_name?: string;
  attempts_count: number;
  created_at: string;
  updated_at: string;
  last_error?: string | null;
};

export type ActionDeliveryAttempt = {
  id: string | number;
  status: string;
  created_at: string;
  error?: string | null;
  response_status?: number | null;
};

export type ActionDeliveryDetail = ActionDelivery & {
  attempts: ActionDeliveryAttempt[];
  payload?: unknown;
};

export type ActionDeliveriesListResponse = {
  count: number;
  results: ActionDelivery[];
};

export type ActionDeliveryListFilters = {
  page?: number;
  page_size?: number;
  status?: string;
  event_type?: string;
  action_rule_id?: number;
};

export type ActionRuleCreatePayload = {
  name: string;
  event: string;
  kind: ActionRuleKind;
  enabled?: boolean;
  config: ActionRuleEmailConfig | ActionRuleWebhookConfig;
};

export type ActionRuleUpdatePayload = Partial<ActionRuleCreatePayload>;

export interface ActionsApiClient {
  fetchEvents(): Promise<ActionEventCatalogEntry[]>;
  fetchRules(): Promise<ActionRule[]>;
  fetchRule(id: ActionRuleId): Promise<ActionRule>;
  createRule(payload: ActionRuleCreatePayload): Promise<ActionRule>;
  updateRule(id: ActionRuleId, payload: ActionRuleUpdatePayload): Promise<ActionRule>;
  deleteRule(id: ActionRuleId): Promise<void>;
  fetchEmailTemplate(ruleId: ActionRuleId, language: string): Promise<ActionEmailTemplate>;
  fetchDefaultEmailTemplate(eventType: string, language: string): Promise<ActionEmailTemplate>;
  fetchDefaultEmailTemplates(
    eventType: string,
    languages: readonly ('en' | 'fr')[],
  ): Promise<Partial<Record<'en' | 'fr', ActionEmailTemplate>>>;
  /** Staff/owner: send substituted sample to the authenticated user's email. */
  sendTestEmailTemplate(
    eventType: string,
    payload: { language: 'en' | 'fr'; subject: string; html: string },
  ): Promise<{ sent_to: string; language: string; subject: string }>;
  fetchDeliveries(filters: ActionDeliveryListFilters): Promise<ActionDeliveriesListResponse>;
  fetchDelivery(id: string): Promise<ActionDeliveryDetail>;
  requeueDelivery(id: string): Promise<void>;
}
