import { parseEmailApiError } from '@/lib/emailApiErrors';
import {
  parseBroadcast,
  parseBroadcastPreview,
  parseBroadcasts,
  type Broadcast,
  type BroadcastAudience,
  type BroadcastCreate,
  type BroadcastPatch,
  type BroadcastPreview,
} from '@/lib/emailBroadcasts';
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
import {
  parseImportResult,
  parseNewsletter,
  parseNewsletters,
  parseSubscriberAdded,
  parseSubscriberPage,
  type Newsletter,
  type NewsletterAddMode,
  type NewsletterAddOutcome,
  type NewsletterImportResult,
  type NewsletterSubscriber,
  type NewsletterSubscriberAdd,
  type NewsletterSubscriberPage,
  type NewsletterSubscriberStatus,
  type NewsletterWrite,
} from '@/lib/emailNewsletters';
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
  fetchBroadcasts: () => Promise<Broadcast[]>;
  fetchBroadcast: (id: number) => Promise<Broadcast>;
  createBroadcast: (body: BroadcastCreate) => Promise<Broadcast>;
  patchBroadcast: (id: number, body: BroadcastPatch) => Promise<Broadcast>;
  deleteBroadcast: (id: number) => Promise<void>;
  /** Who would get it now. Omitting `audience` previews the saved one. */
  previewBroadcast: (id: number, audience?: BroadcastAudience) => Promise<BroadcastPreview>;
  sendBroadcast: (id: number) => Promise<Broadcast>;
  fetchNewsletters: () => Promise<Newsletter[]>;
  fetchNewsletter: (id: number) => Promise<Newsletter>;
  createNewsletter: (body: NewsletterWrite & { name: string }) => Promise<Newsletter>;
  patchNewsletter: (id: number, body: NewsletterWrite) => Promise<Newsletter>;
  deleteNewsletter: (id: number) => Promise<void>;
  rotateNewsletterKey: (id: number) => Promise<Newsletter>;
  fetchSubscribers: (
    id: number,
    query?: { status?: NewsletterSubscriberStatus | ''; email?: string; page?: number },
  ) => Promise<NewsletterSubscriberPage>;
  addSubscriber: (
    id: number,
    body: NewsletterSubscriberAdd,
  ) => Promise<{ outcome: NewsletterAddOutcome; subscriber: NewsletterSubscriber }>;
  deleteSubscriber: (id: number, subscriberId: number) => Promise<void>;
  importSubscribers: (
    id: number,
    body: { csv: string; mode: NewsletterAddMode },
  ) => Promise<NewsletterImportResult>;
  /** The CSV text. */
  exportSubscribers: (id: number, status?: NewsletterSubscriberStatus | '') => Promise<string>;
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

async function requestText(
  baseUrl: string,
  path: string,
  accessToken: string,
  companyId: number,
  accept: string,
  query?: Record<string, string | undefined>,
): Promise<string> {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}${path}`);
  url.searchParams.set('company_id', String(companyId));
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: accept, Authorization: `Bearer ${accessToken}` },
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
  return text;
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
      return parseEmailMetrics(
        await requestText(baseUrl, '/api/v1/metrics', accessToken, companyId, 'text/plain'),
      );
    },
    async fetchBroadcasts() {
      return parseBroadcasts(await call('/api/v1/broadcasts'));
    },
    async fetchBroadcast(id) {
      return parseBroadcast(await call(`/api/v1/broadcasts/${id}`));
    },
    async createBroadcast(body) {
      return parseBroadcast(
        await call('/api/v1/broadcasts', { method: 'POST', body: JSON.stringify(body) }),
      );
    },
    async patchBroadcast(id, body) {
      return parseBroadcast(
        await call(`/api/v1/broadcasts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
      );
    },
    async deleteBroadcast(id) {
      await call(`/api/v1/broadcasts/${id}`, { method: 'DELETE' });
    },
    async previewBroadcast(id, audience) {
      return parseBroadcastPreview(
        await call(`/api/v1/broadcasts/${id}/preview`, {
          method: 'POST',
          body: JSON.stringify(audience ? { audience } : {}),
        }),
      );
    },
    async sendBroadcast(id) {
      return parseBroadcast(await call(`/api/v1/broadcasts/${id}/send`, { method: 'POST' }));
    },
    async fetchNewsletters() {
      return parseNewsletters(await call('/api/v1/newsletters'));
    },
    async fetchNewsletter(id) {
      return parseNewsletter(await call(`/api/v1/newsletters/${id}`));
    },
    async createNewsletter(body) {
      return parseNewsletter(
        await call('/api/v1/newsletters', { method: 'POST', body: JSON.stringify(body) }),
      );
    },
    async patchNewsletter(id, body) {
      return parseNewsletter(
        await call(`/api/v1/newsletters/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
      );
    },
    async deleteNewsletter(id) {
      await call(`/api/v1/newsletters/${id}`, { method: 'DELETE' });
    },
    async rotateNewsletterKey(id) {
      return parseNewsletter(
        await call(`/api/v1/newsletters/${id}/rotate-key`, { method: 'POST' }),
      );
    },
    async fetchSubscribers(id, query) {
      return parseSubscriberPage(
        await call(
          `/api/v1/newsletters/${id}/subscribers`,
          {},
          {
            status: query?.status || undefined,
            email: query?.email || undefined,
            page: query?.page && query.page > 1 ? String(query.page) : undefined,
          },
        ),
      );
    },
    async addSubscriber(id, body) {
      return parseSubscriberAdded(
        await call(`/api/v1/newsletters/${id}/subscribers`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
    },
    async deleteSubscriber(id, subscriberId) {
      await call(`/api/v1/newsletters/${id}/subscribers/${subscriberId}`, { method: 'DELETE' });
    },
    async importSubscribers(id, body) {
      return parseImportResult(
        await call(`/api/v1/newsletters/${id}/subscribers/import`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
    },
    async exportSubscribers(id, status) {
      return requestText(
        baseUrl,
        `/api/v1/newsletters/${id}/subscribers.csv`,
        accessToken,
        companyId,
        'text/csv',
        { status: status || undefined },
      );
    },
  };
}
