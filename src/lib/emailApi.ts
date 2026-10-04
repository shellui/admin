import { parseEmailApiError } from '@/lib/emailApiErrors';
import {
  parseCatalog,
  parseLibrary,
  parseLibraryDetail,
  parseProvider,
  parseRule,
  parseRules,
  parseStats,
  parseTemplate,
  parseTemplates,
  parseTestSend,
  parseVersion,
  parseVersions,
} from '@/lib/emailApiParsers';
import { parseEmailMetrics, type EmailMetricsSnapshot } from '@/lib/emailMetrics';
import type { EmailDocument } from '@/lib/emailDocument';
import type { EmailTranslations } from '@/lib/emailTranslations';
import type {
  EmailCatalog,
  EmailLibrary,
  EmailLibraryDetail,
  EmailLibraryWrite,
  EmailProviderSettings,
  EmailProviderWrite,
  EmailRule,
  EmailRuleCreate,
  EmailRulePatch,
  EmailStats,
  EmailTemplateRow,
  EmailTemplateVersion,
  EmailTestSendResult,
  EmailThemePayload,
} from '@/lib/emailTypes';

export type EmailVersionCreate =
  | {
      subject: string;
      preheader: string;
      document: EmailDocument;
      /** Other languages. Omitted keeps the latest version's. */
      translations?: EmailTranslations;
      /** Omitted keeps the latest version's. */
      theme?: EmailThemePayload;
    }
  | { library_id: number };

export type EmailApiClient = {
  fetchCatalog: () => Promise<EmailCatalog>;
  fetchLibrary: () => Promise<EmailLibrary>;
  fetchLibraryTemplate: (id: number) => Promise<EmailLibraryDetail>;
  createLibraryTemplate: (body: EmailLibraryWrite) => Promise<EmailLibraryDetail>;
  updateLibraryTemplate: (id: number, body: EmailLibraryWrite) => Promise<EmailLibraryDetail>;
  deleteLibraryTemplate: (id: number) => Promise<void>;
  fetchRules: (service?: string) => Promise<EmailRule[]>;
  fetchRule: (id: number) => Promise<EmailRule>;
  createRule: (body: EmailRuleCreate) => Promise<EmailRule>;
  patchRule: (id: number, body: EmailRulePatch) => Promise<EmailRule>;
  deleteRule: (id: number) => Promise<void>;
  fetchTemplates: (eventType?: string) => Promise<EmailTemplateRow[]>;
  fetchTemplate: (id: number) => Promise<EmailTemplateRow>;
  fetchVersions: (id: number) => Promise<EmailTemplateVersion[]>;
  fetchVersion: (id: number, number: number) => Promise<EmailTemplateVersion>;
  /** A draft from an edit, or from a library template to start over. */
  createVersion: (id: number, body: EmailVersionCreate) => Promise<{ number: number }>;
  publishVersion: (
    id: number,
    number: number,
  ) => Promise<{ number: number; state: string; checksum: string }>;
  fetchProvider: () => Promise<EmailProviderSettings>;
  saveProvider: (body: EmailProviderWrite) => Promise<EmailProviderSettings>;
  testProvider: (to: string) => Promise<EmailTestSendResult>;
  sendTemplateTest: (
    id: number,
    body: {
      document: EmailDocument;
      subject: string;
      preheader: string;
      theme?: EmailThemePayload;
      to?: string;
    },
  ) => Promise<EmailTestSendResult>;
  fetchStats: (query?: {
    from?: string;
    to?: string;
    lane?: string;
    eventType?: string;
  }) => Promise<EmailStats>;
  fetchMetrics: () => Promise<EmailMetricsSnapshot>;
};

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function request(
  baseUrl: string,
  path: string,
  accessToken: string,
  companyId: number,
  init: RequestInit = {},
  query?: Record<string, string | undefined>,
): Promise<unknown> {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`);
  url.searchParams.set('company_id', String(companyId));
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(url.toString(), { ...init, headers });
  const body = await readBody(res);
  if (!res.ok) throw parseEmailApiError(body, res.status);
  return body;
}

export function createEmailApiClient(
  baseUrl: string,
  accessToken: string,
  companyId: number,
): EmailApiClient {
  const call = (path: string, init?: RequestInit, query?: Record<string, string | undefined>) =>
    request(baseUrl, path, accessToken, companyId, init, query);

  return {
    async fetchCatalog() {
      return parseCatalog(await call('/api/v1/catalog'));
    },
    async fetchLibrary() {
      return parseLibrary(await call('/api/v1/library'));
    },
    async fetchLibraryTemplate(id) {
      return parseLibraryDetail(await call(`/api/v1/library/${id}`));
    },
    async createLibraryTemplate(body) {
      return parseLibraryDetail(
        await call('/api/v1/library', { method: 'POST', body: JSON.stringify(body) }),
      );
    },
    async updateLibraryTemplate(id, body) {
      return parseLibraryDetail(
        await call(`/api/v1/library/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      );
    },
    async deleteLibraryTemplate(id) {
      await call(`/api/v1/library/${id}`, { method: 'DELETE' });
    },
    async fetchRules(service) {
      return parseRules(await call('/api/v1/rules', {}, service ? { service } : undefined));
    },
    async fetchRule(id) {
      return parseRule(await call(`/api/v1/rules/${id}`));
    },
    async createRule(body) {
      return parseRule(await call('/api/v1/rules', { method: 'POST', body: JSON.stringify(body) }));
    },
    async patchRule(id, body) {
      return parseRule(
        await call(`/api/v1/rules/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
      );
    },
    async deleteRule(id) {
      await call(`/api/v1/rules/${id}`, { method: 'DELETE' });
    },
    async fetchTemplates(eventType) {
      return parseTemplates(
        await call('/api/v1/templates', {}, eventType ? { event_type: eventType } : undefined),
      );
    },
    async fetchTemplate(id) {
      return parseTemplate(await call(`/api/v1/templates/${id}`));
    },
    async fetchVersions(id) {
      return parseVersions(await call(`/api/v1/templates/${id}/versions`));
    },
    async fetchVersion(id, number) {
      return parseVersion(await call(`/api/v1/templates/${id}/versions/${number}`));
    },
    async createVersion(id, body) {
      const created = await call(`/api/v1/templates/${id}/versions`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const row =
        created && typeof created === 'object' ? (created as Record<string, unknown>) : {};
      return { number: typeof row.number === 'number' ? row.number : 0 };
    },
    async publishVersion(id, number) {
      const published = await call(`/api/v1/templates/${id}/versions/${number}/publish`, {
        method: 'POST',
      });
      const row =
        published && typeof published === 'object' ? (published as Record<string, unknown>) : {};
      return {
        number: typeof row.number === 'number' ? row.number : number,
        state: typeof row.state === 'string' ? row.state : '',
        checksum: typeof row.checksum === 'string' ? row.checksum : '',
      };
    },
    async fetchProvider() {
      return parseProvider(await call('/api/v1/provider'));
    },
    async saveProvider(body) {
      return parseProvider(
        await call('/api/v1/provider', { method: 'PUT', body: JSON.stringify(body) }),
      );
    },
    async testProvider(to) {
      return parseTestSend(
        await call('/api/v1/provider/test-send', { method: 'POST', body: JSON.stringify({ to }) }),
      );
    },
    async sendTemplateTest(id, body) {
      const payload: Record<string, unknown> = {
        document: body.document,
        subject: body.subject,
        preheader: body.preheader,
      };
      if (body.theme) payload.theme = body.theme;
      if (body.to) payload.to = body.to;
      return parseTestSend(
        await call(`/api/v1/templates/${id}/send-test`, {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    },
    async fetchStats(query) {
      return parseStats(
        await call(
          '/api/v1/stats',
          {},
          {
            from: query?.from,
            to: query?.to,
            lane: query?.lane,
            event_type: query?.eventType,
          },
        ),
      );
    },
    async fetchMetrics() {
      const url = new URL(`${baseUrl.replace(/\/+$/, '')}/api/v1/metrics`);
      url.searchParams.set('company_id', String(companyId));
      const res = await fetch(url.toString(), {
        headers: {
          Accept: 'text/plain',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const text = await res.text();
      if (!res.ok) {
        let body: unknown = null;
        try {
          body = JSON.parse(text);
        } catch {
          body = null;
        }
        throw parseEmailApiError(body, res.status);
      }
      return parseEmailMetrics(text);
    },
  };
}
