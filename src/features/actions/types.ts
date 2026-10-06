export type ActionRuleId = string | number;

export type ActionEventCatalogEntry = {
  key: string;
  label?: string;
  description?: string;
  /** Sample webhook JSON body for this event (company-scoped from identity). */
  sample_envelope?: unknown;
};

export type ActionRuleWebhookConfig = {
  url: string;
  secret?: string;
  auth_header_name?: string;
  auth_header_value?: string;
  /** New API: server stores secret but never returns it on read. */
  has_secret?: boolean;
  secret_hint?: string;
  /** Legacy identity builds used secret_set instead of has_secret. */
  secret_set?: boolean;
  authorization_header_set?: boolean;
};

export type ActionRule = {
  id: ActionRuleId;
  name: string;
  event: string;
  enabled: boolean;
  config: ActionRuleWebhookConfig;
  created_at: string;
  updated_at: string;
};

export type ActionRuleMutationResult = {
  rule: ActionRule;
  /** Plaintext signing secret returned only on create or rotate-secret. */
  revealedSecret?: string;
};

export type ActionRuleSendTestResult = {
  ok: boolean;
  webhook_id: string;
  event_type: string;
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
  /** identity-service: `dispatch` (first try) or `automatic_retry` (retry_webhooks job). */
  trigger?: string | null;
  /** identity-service, staff only: scheduled job run that made this attempt. */
  scheduled_job_run_id?: number | null;
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
  enabled?: boolean;
  config: ActionRuleWebhookConfig;
};

export type ActionRuleUpdatePayload = Partial<ActionRuleCreatePayload> & {
  enabled?: boolean;
};

export interface ActionsApiClient {
  fetchEvents(): Promise<ActionEventCatalogEntry[]>;
  fetchRules(): Promise<ActionRule[]>;
  fetchRule(id: ActionRuleId): Promise<ActionRule>;
  createRule(payload: ActionRuleCreatePayload): Promise<ActionRuleMutationResult>;
  updateRule(id: ActionRuleId, payload: ActionRuleUpdatePayload): Promise<ActionRule>;
  rotateRuleSecret(id: ActionRuleId): Promise<ActionRuleMutationResult>;
  deleteRule(id: ActionRuleId): Promise<void>;
  sendRuleTest(id: ActionRuleId): Promise<ActionRuleSendTestResult>;
  fetchDeliveries(filters: ActionDeliveryListFilters): Promise<ActionDeliveriesListResponse>;
  fetchDelivery(id: string): Promise<ActionDeliveryDetail>;
  requeueDelivery(id: string): Promise<void>;
}
