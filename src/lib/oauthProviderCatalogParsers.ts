import type {
  OAuthCatalogProvider,
  OAuthConsoleUrlEntry,
  OAuthExtraSettingField,
  OAuthProviderCatalogResponse,
  OAuthProviderTier,
} from '@/lib/oauthProviderCatalogTypes';
import { extractConsoleUrlFromLegacyCopy, inferConsoleUrlKind } from '@/lib/oauthConsoleUrlKind';

function parseConsoleUrlEntry(raw: unknown): OAuthConsoleUrlEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const text = typeof o.text === 'string' ? o.text : '';
  const label = typeof o.label === 'string' ? o.label : '';
  const rawUrl = typeof o.url === 'string' ? o.url : '';
  let url = extractConsoleUrlFromLegacyCopy(rawUrl, text, label);
  if (!url && label.startsWith('http')) url = label.trim();
  const form = typeof o.form === 'string' ? o.form : 'link';
  if (!url.trim() && !label.trim() && !text.trim()) return null;
  const placeholders = Array.isArray(o.placeholders)
    ? o.placeholders.filter((p): p is string => typeof p === 'string')
    : undefined;
  return {
    kind: inferConsoleUrlKind(o),
    url: url.trim(),
    form,
    placeholders,
    text: text || undefined,
    label: label || undefined,
  };
}

function parseExtraField(raw: unknown): OAuthExtraSettingField | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!name) return null;
  return {
    name,
    label: typeof o.label === 'string' ? o.label : name,
    type: typeof o.type === 'string' ? o.type : 'string',
    required: o.required === true,
    secret: o.secret === true,
    help_text: typeof o.help_text === 'string' ? o.help_text : '',
  };
}

function parseTier(raw: unknown): OAuthProviderTier {
  const tier = String(raw || 'other').toLowerCase();
  if (tier === 'popular' || tier === 'generic' || tier === 'other') return tier;
  return 'other';
}

export function parseCatalogProvider(raw: unknown): OAuthCatalogProvider | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const docsSlug = typeof o.docs_slug === 'string' ? o.docs_slug.trim().toLowerCase() : '';
  if (!docsSlug) return null;
  const consoleUrl = Array.isArray(o.console_url)
    ? o.console_url
        .map(parseConsoleUrlEntry)
        .filter((entry): entry is OAuthConsoleUrlEntry => entry != null)
    : [];
  const extra_settings_schema = Array.isArray(o.extra_settings_schema)
    ? o.extra_settings_schema
        .map(parseExtraField)
        .filter((field): field is OAuthExtraSettingField => field != null)
    : [];
  return {
    docs_slug: docsSlug,
    name: typeof o.name === 'string' ? o.name : docsSlug,
    tier: parseTier(o.tier),
    legacy: o.legacy === true,
    replaced_by:
      typeof o.replaced_by === 'string' && o.replaced_by.trim() ? o.replaced_by.trim() : null,
    protocol: typeof o.protocol === 'string' ? o.protocol : '',
    supported: o.supported !== false,
    unsupported_reason:
      typeof o.unsupported_reason === 'string' && o.unsupported_reason.trim()
        ? o.unsupported_reason.trim()
        : null,
    icon: (o.icon && typeof o.icon === 'object' ? o.icon : {}) as OAuthCatalogProvider['icon'],
    docs_url: typeof o.docs_url === 'string' ? o.docs_url : '',
    console_url: consoleUrl,
    callback_url: typeof o.callback_url === 'string' ? o.callback_url : '',
    extra_settings_schema,
    multiple_allowed: typeof o.multiple_allowed === 'boolean' ? o.multiple_allowed : undefined,
  };
}

export function parseOAuthProviderCatalog(body: unknown): OAuthProviderCatalogResponse {
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected oauth-provider-catalog response.');
  }
  const o = body as Record<string, unknown>;
  const providers = Array.isArray(o.providers)
    ? o.providers
        .map(parseCatalogProvider)
        .filter((entry): entry is OAuthCatalogProvider => entry != null)
    : [];
  return {
    catalog_version: typeof o.catalog_version === 'string' ? o.catalog_version : '1',
    allauth_version: typeof o.allauth_version === 'string' ? o.allauth_version : '',
    callback_url: typeof o.callback_url === 'string' ? o.callback_url : '',
    providers,
  };
}
