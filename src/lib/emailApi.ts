import { EmailApiError, parseEmailApiError } from '@/lib/emailApiErrors';
import {
  parseCatalog,
  parseCompanySettings,
  parseProvider,
  parseRule,
  parseRules,
  parseSettingsUpdate,
  parseStats,
  parseTemplateDefaults,
  parseTemplates,
  parseTestSend,
  parseThemes,
  parseVersion,
  parseVersions,
} from '@/lib/emailApiParsers';
import { parseEmailMetrics, type EmailMetricsSnapshot } from '@/lib/emailMetrics';
import type { EmailDocument } from '@/lib/emailDocument';
import type {
  EmailCatalog,
  EmailCompanySettings,
  EmailProviderSettings,
  EmailProviderWrite,
  EmailRule,
  EmailRuleCreate,
  EmailRulePatch,
  EmailSettingsUpdate,
  EmailStats,
  EmailTemplateDefaults,
  EmailTemplateRow,
  EmailTemplateVersion,
  EmailTestSendResult,
  EmailTheme,
} from '@/lib/emailTypes';

export type EmailApiClient = {
  fetchCatalog: () => Promise<EmailCatalog>;
  fetchThemes: () => Promise<EmailTheme[]>;
  fetchThemePreview: (previewUrl: string) => Promise<string>;
  fetchSettings: () => Promise<EmailCompanySettings>;
  saveSettings: (body: {
    theme: string;
    apply_to_existing: boolean;
  }) => Promise<EmailSettingsUpdate>;
  fetchRules: (service?: string) => Promise<EmailRule[]>;
  fetchRule: (id: number) => Promise<EmailRule>;
  createRule: (body: EmailRuleCreate) => Promise<EmailRule>;
  patchRule: (id: number, body: EmailRulePatch) => Promise<EmailRule>;
  deleteRule: (id: number) => Promise<void>;
  fetchTemplates: (eventType?: string) => Promise<EmailTemplateRow[]>;
  createTemplate: (
    templateKey: string,
    language: string,
  ) => Promise<{ id: number; draftVersion: number }>;
  deleteTemplate: (id: number) => Promise<void>;
  fetchVersions: (id: number) => Promise<EmailTemplateVersion[]>;
  fetchVersion: (id: number, number: number) => Promise<EmailTemplateVersion>;
  createVersion: (
    id: number,
    body: {
      subject: string;
      preheader: string;
      document: EmailDocument;
      theme_name?: string;
      theme_palette?: Record<string, string>;
    },
  ) => Promise<{ number: number }>;
  publishVersion: (
    id: number,
    number: number,
  ) => Promise<{ number: number; state: string; checksum: string }>;
  fetchDefaults: (templateKey: string) => Promise<EmailTemplateDefaults>;
  fetchProvider: () => Promise<EmailProviderSettings>;
  saveProvider: (body: EmailProviderWrite) => Promise<EmailProviderSettings>;
  testProvider: (to: string) => Promise<EmailTestSendResult>;
  sendTemplateTest: (
    id: number,
    body: {
      document: EmailDocument;
      subject: string;
      preheader: string;
      theme_name?: string;
      theme_palette: Record<string, string>;
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
    async fetchThemes() {
      return parseThemes(await call('/api/v1/themes'));
    },
    async fetchThemePreview(previewUrl) {
      const url = new URL(previewUrl, `${baseUrl.replace(/\/+$/, '')}/`);
      if (!url.searchParams.has('company_id')) {
        url.searchParams.set('company_id', String(companyId));
      }
      const res = await fetch(url.toString(), {
        headers: {
          Accept: 'text/html',
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
      return text;
    },
    async fetchSettings() {
      return parseCompanySettings(await call('/api/v1/settings'));
    },
    async saveSettings(body) {
      return parseSettingsUpdate(
        await call('/api/v1/settings', { method: 'PUT', body: JSON.stringify(body) }),
      );
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
    async createTemplate(templateKey, language) {
      const body = await call('/api/v1/templates', {
        method: 'POST',
        body: JSON.stringify({ template_key: templateKey, language }),
      });
      const row = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
      const id = typeof row.id === 'number' ? row.id : 0;
      const draftVersion = typeof row.draft_version === 'number' ? row.draft_version : 0;
      if (!id) throw new EmailApiError('request_failed', 201);
      return { id, draftVersion };
    },
    async deleteTemplate(id) {
      await call(`/api/v1/templates/${id}`, { method: 'DELETE' });
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
    async fetchDefaults(templateKey) {
      return parseTemplateDefaults(
        await call(
          '/api/v1/templates/defaults',
          {},
          { template_key: templateKey, languages: 'en,fr' },
        ),
      );
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
        theme_palette: body.theme_palette,
      };
      if (body.theme_name) payload.theme_name = body.theme_name;
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
