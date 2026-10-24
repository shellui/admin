import type { ShellUIMessage } from '@shellui/sdk';

/**
 * Nested ContentView frames that may receive `settings.accessToken`.
 * Same-origin admin pages are trusted without a rule. Every other URL is opt-in.
 */
export type ContentFrameAuthRule = {
  /** App URL (files explorer, Swagger, custom admin app, …). */
  url: string;
  /** Host marked this embed with `safeForAuthToken: true`. */
  safeForAuthToken?: boolean;
  /** ContentView skips URL sync (Swagger, ReDoc). */
  ignoreMessages?: boolean;
};

export type FrameSettingsDelivery = {
  /** When false, do not post settings to this frame. */
  forward: boolean;
  includeAccessToken: boolean;
};

let rules: ContentFrameAuthRule[] = [];

export function setContentFrameAuthRules(next: readonly ContentFrameAuthRule[]): void {
  rules = next.map((rule) => ({
    url: rule.url,
    safeForAuthToken: rule.safeForAuthToken === true,
    ignoreMessages: rule.ignoreMessages === true,
  }));
}

export function getContentFrameAuthRules(): readonly ContentFrameAuthRule[] {
  return rules;
}

export function contentFrameAuthRulesFromEmbeds(
  items: readonly {
    embedUrl: string;
    safeForAuthToken?: boolean;
    ignoreMessages?: boolean;
  }[],
): ContentFrameAuthRule[] {
  const out: ContentFrameAuthRule[] = [];
  for (const item of items) {
    const url = item.embedUrl.trim();
    if (!url) continue;
    out.push({
      url,
      safeForAuthToken: item.safeForAuthToken === true,
      ignoreMessages: item.ignoreMessages === true,
    });
  }
  return out;
}

function toAbsoluteUrl(url: string, baseHref: string): URL | null {
  try {
    return new URL(url, baseHref);
  } catch {
    return null;
  }
}

function normalizePathname(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  const withoutTrailing = trimmed.replace(/\/+$/, '');
  return withoutTrailing || '/';
}

function normalizeHashPath(value: string): string {
  return value.replace(/^#\/?/, '').replace(/\/+$/, '');
}

/**
 * Whether an iframe `src` belongs to an embedded app URL (same origin and path/hash prefix).
 * A site-root app (`https://files.example/`) also matches a deep link.
 */
export function frameSrcMatchesAppUrl(frameSrc: string, appUrl: string, baseHref: string): boolean {
  const frame = toAbsoluteUrl(frameSrc, baseHref);
  const app = toAbsoluteUrl(appUrl, baseHref);
  if (!frame || !app) return false;
  if (frame.origin !== app.origin) return false;
  if (frame.protocol !== 'http:' && frame.protocol !== 'https:') return false;

  const appPathname = normalizePathname(app.pathname);
  const framePathname = normalizePathname(frame.pathname);
  const pathMatches =
    appPathname === '/'
      ? true
      : framePathname === appPathname || framePathname.startsWith(`${appPathname}/`);
  if (!pathMatches) return false;

  const appHashPath = normalizeHashPath(app.hash);
  if (!appHashPath) return true;

  const frameHashPath = normalizeHashPath(frame.hash);
  return frameHashPath === appHashPath || frameHashPath.startsWith(`${appHashPath}/`);
}

function ruleSpecificity(rule: ContentFrameAuthRule, baseHref: string): number {
  const app = toAbsoluteUrl(rule.url, baseHref);
  if (!app) return -1;
  return normalizePathname(app.pathname).length + normalizeHashPath(app.hash).length;
}

/** Longest matching app URL wins when a files root and a nested app share an origin. */
export function matchContentFrameRule(
  frameSrc: string,
  frameRules: readonly ContentFrameAuthRule[],
  baseHref: string,
): ContentFrameAuthRule | null {
  let best: ContentFrameAuthRule | null = null;
  let bestLen = -1;
  for (const rule of frameRules) {
    if (!frameSrcMatchesAppUrl(frameSrc, rule.url, baseHref)) continue;
    const len = ruleSpecificity(rule, baseHref);
    if (len > bestLen) {
      best = rule;
      bestLen = len;
    }
  }
  return best;
}

/** True for the admin app's own content iframe (hash routes on this origin). */
export function isSameOriginAdminFrame(frameSrc: string, pageHref: string): boolean {
  const frame = toAbsoluteUrl(frameSrc, pageHref);
  const page = toAbsoluteUrl(pageHref, pageHref);
  if (!frame || !page) return false;
  if (frame.protocol !== 'http:' && frame.protocol !== 'https:') return false;
  return frame.origin === page.origin;
}

/**
 * `accessToken` is included for same-origin admin frames and for URLs marked
 * `safeForAuthToken`. Other frames still receive settings (theme, language, logout)
 * with the token removed.
 *
 * `ignoreMessages` frames (ReDoc) are left out of the fan-out. A settings reply
 * addressed to that frame is still delivered, without the token, so the first
 * handshake can apply appearance. Swagger is `ignoreMessages` and
 * `safeForAuthToken`, so it keeps the token.
 */
export function frameSettingsDelivery(
  frameSrc: string,
  frameRules: readonly ContentFrameAuthRule[],
  pageHref: string,
): FrameSettingsDelivery {
  if (isSameOriginAdminFrame(frameSrc, pageHref)) {
    return { forward: true, includeAccessToken: true };
  }
  const rule = matchContentFrameRule(frameSrc, frameRules, pageHref);
  if (rule?.ignoreMessages && !rule.safeForAuthToken) {
    return { forward: false, includeAccessToken: false };
  }
  if (rule?.safeForAuthToken) {
    return { forward: true, includeAccessToken: true };
  }
  return { forward: true, includeAccessToken: false };
}

export function settingsPayloadForDelivery(
  payload: ShellUIMessage['payload'],
  includeAccessToken: boolean,
): ShellUIMessage['payload'] {
  if (includeAccessToken) return payload;
  if (!payload || typeof payload !== 'object' || !('settings' in payload)) return payload;
  const settings = payload.settings;
  if (!settings || typeof settings !== 'object') return payload;
  return {
    ...payload,
    settings: {
      ...(settings as Record<string, unknown>),
      accessToken: null,
    },
  };
}
