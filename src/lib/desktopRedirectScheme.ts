/** Published identity-service page for desktop sign-in. */
export const IDENTITY_DESKTOP_APPS_DOCS_URL = 'https://docs.shellui.com/identity/desktop-apps/';

/** Placeholder shown until a scheme is valid. Matches the deep link the app opens. */
export const DESKTOP_SIGN_IN_DEEP_LINK_PLACEHOLDER = '<scheme>://callback';

/**
 * Schemes identity-service refuses in `normalize_registered_scheme`.
 * Keep this set aligned with `_DENIED_REDIRECT_SCHEMES` in identity-service.
 */
const DENIED_REDIRECT_SCHEMES = new Set([
  'http',
  'https',
  'javascript',
  'data',
  'file',
  'vbscript',
  'about',
  'blob',
  'ftp',
  'ftps',
  'ws',
  'wss',
  'mailto',
  'tel',
  'sms',
  'ssh',
  'sftp',
  'ldap',
  'ldaps',
  'chrome',
  'chrome-extension',
  'moz-extension',
  'ms-appx',
  'ms-appx-web',
  'intent',
  'market',
  'content',
  'android-app',
  'view-source',
  'filesystem',
  'jar',
  'nfs',
  'tftp',
  'gopher',
  'news',
  'nntp',
  'irc',
  'ircs',
  'magnet',
  'cid',
  'mid',
  'mms',
  'mmsto',
  'ms-help',
  'res',
  'mk',
  'mhtml',
  'webcal',
  'feed',
  'git',
  'svn',
  'dict',
  'wais',
  'shttp',
  'urn',
  'uuid',
  'geo',
  'telnet',
  'rtsp',
  'rtspu',
  'sip',
  'sips',
  'xmpp',
  'callto',
  'facetime',
  'facetime-audio',
  'maps',
  'ms-settings',
  'microsoft-edge',
  'chrome-error',
  'chrome-devtools',
  'resource',
  'android',
  'dns',
  'ipp',
  'ipps',
  'dav',
  'imap',
  'pop',
  'smtp',
]);

/** RFC 3986 scheme, stored lowercase: a letter, then letters, digits, "+", "-", or ".". */
const RFC3986_SCHEME_RE = /^[a-z][a-z0-9+.-]*$/;

export type DesktopSchemeIssue = 'lowercase' | 'shape' | 'denied';

export function desktopSchemeIssueMessageKey(issue: DesktopSchemeIssue): string {
  switch (issue) {
    case 'lowercase':
      return 'oauthDesktopSchemeLowercase';
    case 'shape':
      return 'oauthDesktopSchemeRfc';
    case 'denied':
      return 'oauthDesktopSchemeDenied';
  }
}

/** Same order and messages as identity-service `normalize_registered_scheme`. Empty is off. */
export function desktopRedirectSchemeIssue(raw: string): DesktopSchemeIssue | null {
  const scheme = (raw || '').trim();
  if (!scheme) return null;
  if (scheme !== scheme.toLowerCase()) return 'lowercase';
  if (scheme.length > 64 || RFC3986_SCHEME_RE.test(scheme) === false) return 'shape';
  if (DENIED_REDIRECT_SCHEMES.has(scheme) || scheme.startsWith('web+')) return 'denied';
  return null;
}

export function desktopSignInDeepLink(raw: string): string {
  const scheme = (raw || '').trim();
  if (!scheme || desktopRedirectSchemeIssue(raw)) return DESKTOP_SIGN_IN_DEEP_LINK_PLACEHOLDER;
  return `${scheme}://callback`;
}
