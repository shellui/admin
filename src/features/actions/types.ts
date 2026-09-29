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
  createRule(payload: ActionRuleCreatePayload): Promise<ActionRule>;
  updateRule(id: ActionRuleId, payload: ActionRuleUpdatePayload): Promise<ActionRule>;
  deleteRule(id: ActionRuleId): Promise<void>;
  sendRuleTest(id: ActionRuleId): Promise<ActionRuleSendTestResult>;
  fetchDeliveries(filters: ActionDeliveryListFilters): Promise<ActionDeliveriesListResponse>;
  fetchDelivery(id: string): Promise<ActionDeliveryDetail>;
  requeueDelivery(id: string): Promise<void>;
}
