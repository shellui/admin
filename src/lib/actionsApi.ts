import { identityAuthFetch, readJsonOrThrow } from '@/lib/adminIdentityFetch';
import type {
  ActionDeliveriesListResponse,
  ActionDeliveryDetail,
  ActionDeliveryListFilters,
  ActionEventCatalogEntry,
  ActionRule,
  ActionRuleCreatePayload,
  ActionRuleId,
  ActionRuleUpdatePayload,
  ActionsApiClient,
} from '@/features/actions/types';
import {
  parseDeliveriesList,
  parseDeliveryDetail,
  parseEventsList,
  parseIdentityRule,
  parseIdentityRuleResponse,
  parseRulesList,
  parseSendTestResult,
  toIdentityRuleWriteBody,
} from '@/lib/actionsApiParsers';

export const ACTIONS_API_UNAVAILABLE =
  'Actions API is not available on this identity version. Update identity-service or run a build that includes company actions endpoints.';

function rulePath(id: ActionRuleId): string {
  return `/api/v1/actions/rules/${encodeURIComponent(String(id))}`;
}

export function createIdentityActionsApiClient(
  accessToken: string,
  companyId: number,
): ActionsApiClient {
  const company = { companyId };

  return {
    async fetchEvents(): Promise<ActionEventCatalogEntry[]> {
      const res = await identityAuthFetch('/api/v1/actions/events', accessToken, {}, company);
      const body = await readJsonOrThrow(res, ACTIONS_API_UNAVAILABLE);
      return parseEventsList(body);
    },

    async fetchRules(): Promise<ActionRule[]> {
      const res = await identityAuthFetch('/api/v1/actions/rules', accessToken, {}, company);
      const body = await readJsonOrThrow(res, ACTIONS_API_UNAVAILABLE);
      return parseRulesList(body);
    },

    async fetchRule(id: ActionRuleId): Promise<ActionRule> {
      const res = await identityAuthFetch(rulePath(id), accessToken, {}, company);
      const body = await readJsonOrThrow(res, ACTIONS_API_UNAVAILABLE);
      return parseIdentityRule(body);
    },

    async createRule(payload: ActionRuleCreatePayload) {
      const res = await identityAuthFetch(
        '/api/v1/actions/rules',
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify(toIdentityRuleWriteBody(payload)),
        },
        company,
      );
      const body = await readJsonOrThrow(res, ACTIONS_API_UNAVAILABLE);
      return parseIdentityRuleResponse(body);
    },

    async rotateRuleSecret(id: ActionRuleId) {
      const res = await identityAuthFetch(
        `${rulePath(id)}/rotate-secret`,
        accessToken,
        { method: 'POST' },
        company,
      );
      const body = await readJsonOrThrow(res, ACTIONS_API_UNAVAILABLE);
      return parseIdentityRuleResponse(body);
    },

    async updateRule(id: ActionRuleId, payload: ActionRuleUpdatePayload): Promise<ActionRule> {
      const res = await identityAuthFetch(
        rulePath(id),
        accessToken,
        {
          method: 'PATCH',
          body: JSON.stringify(toIdentityRuleWriteBody(payload, { partial: true })),
        },
        company,
      );
      const body = await readJsonOrThrow(res, ACTIONS_API_UNAVAILABLE);
      return parseIdentityRule(body);
    },

    async sendRuleTest(id: ActionRuleId) {
      const res = await identityAuthFetch(
        `${rulePath(id)}/send-test`,
        accessToken,
        { method: 'POST' },
        company,
      );
      const body = await readJsonOrThrow(res, ACTIONS_API_UNAVAILABLE);
      return parseSendTestResult(body);
    },

    async deleteRule(id: ActionRuleId): Promise<void> {
      const res = await identityAuthFetch(
        rulePath(id),
        accessToken,
        {
          method: 'DELETE',
        },
        company,
      );
      if (res.status === 404) {
        await readJsonOrThrow(res, ACTIONS_API_UNAVAILABLE);
      }
      if (res.status === 204 || res.ok) return;
      await readJsonOrThrow(res, ACTIONS_API_UNAVAILABLE);
    },

    async fetchDeliveries(
      filters: ActionDeliveryListFilters,
    ): Promise<ActionDeliveriesListResponse> {
      const res = await identityAuthFetch(
        '/api/v1/actions/deliveries',
        accessToken,
        {},
        {
          ...company,
          query: {
            page: filters.page,
            page_size: filters.page_size,
            status: filters.status,
            event_type: filters.event_type,
            action_rule_id: filters.action_rule_id,
          },
        },
      );
      const body = await readJsonOrThrow(res, ACTIONS_API_UNAVAILABLE);
      return parseDeliveriesList(body);
    },

    async fetchDelivery(id: string): Promise<ActionDeliveryDetail> {
      const res = await identityAuthFetch(
        `/api/v1/actions/deliveries/${encodeURIComponent(id)}`,
        accessToken,
        {},
        company,
      );
      const body = await readJsonOrThrow(res, ACTIONS_API_UNAVAILABLE);
      return parseDeliveryDetail(body);
    },

    async requeueDelivery(id: string): Promise<void> {
      const res = await identityAuthFetch(
        `/api/v1/actions/deliveries/${encodeURIComponent(id)}/requeue`,
        accessToken,
        { method: 'POST' },
        company,
      );
      if (res.ok) return;
      await readJsonOrThrow(res, ACTIONS_API_UNAVAILABLE);
    },
  };
}
