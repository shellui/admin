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
import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import { readServiceJsonOrThrow, serviceAuthFetch } from '@/lib/serviceAuthFetch';
import {
  actionsApiUnavailableMessage,
  DEFAULT_WEBHOOK_SERVICE,
  type WebhookServiceKey,
} from '@/lib/webhookServices';

export const ACTIONS_API_UNAVAILABLE = actionsApiUnavailableMessage(DEFAULT_WEBHOOK_SERVICE);

function rulePath(id: ActionRuleId): string {
  return `/api/v1/actions/rules/${encodeURIComponent(String(id))}`;
}

export function createActionsApiClient(
  baseUrl: string,
  accessToken: string,
  companyId: number,
  service: WebhookServiceKey = DEFAULT_WEBHOOK_SERVICE,
): ActionsApiClient {
  const unavailableMessage = actionsApiUnavailableMessage(service);
  const company = { companyId };

  return {
    async fetchEvents(): Promise<ActionEventCatalogEntry[]> {
      const res = await serviceAuthFetch(
        baseUrl,
        '/api/v1/actions/events',
        accessToken,
        {},
        company,
      );
      const body = await readServiceJsonOrThrow(res, unavailableMessage);
      return parseEventsList(body);
    },

    async fetchRules(): Promise<ActionRule[]> {
      const res = await serviceAuthFetch(
        baseUrl,
        '/api/v1/actions/rules',
        accessToken,
        {},
        company,
      );
      const body = await readServiceJsonOrThrow(res, unavailableMessage);
      return parseRulesList(body);
    },

    async fetchRule(id: ActionRuleId): Promise<ActionRule> {
      const res = await serviceAuthFetch(baseUrl, rulePath(id), accessToken, {}, company);
      const body = await readServiceJsonOrThrow(res, unavailableMessage);
      return parseIdentityRule(body);
    },

    async createRule(payload: ActionRuleCreatePayload) {
      const res = await serviceAuthFetch(
        baseUrl,
        '/api/v1/actions/rules',
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify(toIdentityRuleWriteBody(payload)),
        },
        company,
      );
      const body = await readServiceJsonOrThrow(res, unavailableMessage);
      return parseIdentityRuleResponse(body);
    },

    async rotateRuleSecret(id: ActionRuleId) {
      const res = await serviceAuthFetch(
        baseUrl,
        `${rulePath(id)}/rotate-secret`,
        accessToken,
        { method: 'POST' },
        company,
      );
      const body = await readServiceJsonOrThrow(res, unavailableMessage);
      return parseIdentityRuleResponse(body);
    },

    async updateRule(id: ActionRuleId, payload: ActionRuleUpdatePayload): Promise<ActionRule> {
      const res = await serviceAuthFetch(
        baseUrl,
        rulePath(id),
        accessToken,
        {
          method: 'PATCH',
          body: JSON.stringify(toIdentityRuleWriteBody(payload, { partial: true })),
        },
        company,
      );
      const body = await readServiceJsonOrThrow(res, unavailableMessage);
      return parseIdentityRule(body);
    },

    async sendRuleTest(id: ActionRuleId) {
      const res = await serviceAuthFetch(
        baseUrl,
        `${rulePath(id)}/send-test`,
        accessToken,
        { method: 'POST' },
        company,
      );
      const body = await readServiceJsonOrThrow(res, unavailableMessage);
      return parseSendTestResult(body);
    },

    async deleteRule(id: ActionRuleId): Promise<void> {
      const res = await serviceAuthFetch(
        baseUrl,
        rulePath(id),
        accessToken,
        {
          method: 'DELETE',
        },
        company,
      );
      if (res.status === 404) {
        await readServiceJsonOrThrow(res, unavailableMessage);
      }
      if (res.status === 204 || res.ok) return;
      await readServiceJsonOrThrow(res, unavailableMessage);
    },

    async fetchDeliveries(
      filters: ActionDeliveryListFilters,
    ): Promise<ActionDeliveriesListResponse> {
      const res = await serviceAuthFetch(
        baseUrl,
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
      const body = await readServiceJsonOrThrow(res, unavailableMessage);
      return parseDeliveriesList(body);
    },

    async fetchDelivery(id: string): Promise<ActionDeliveryDetail> {
      const res = await serviceAuthFetch(
        baseUrl,
        `/api/v1/actions/deliveries/${encodeURIComponent(id)}`,
        accessToken,
        {},
        company,
      );
      const body = await readServiceJsonOrThrow(res, unavailableMessage);
      return parseDeliveryDetail(body);
    },

    async requeueDelivery(id: string): Promise<void> {
      const res = await serviceAuthFetch(
        baseUrl,
        `/api/v1/actions/deliveries/${encodeURIComponent(id)}/requeue`,
        accessToken,
        { method: 'POST' },
        company,
      );
      if (res.ok) return;
      await readServiceJsonOrThrow(res, unavailableMessage);
    },
  };
}

/** @deprecated Prefer `createActionsApiClient` with an explicit base URL. */
export function createIdentityActionsApiClient(
  accessToken: string,
  companyId: number,
): ActionsApiClient {
  return createActionsApiClient(getAuthBackendBaseUrl(), accessToken, companyId, 'identity');
}
