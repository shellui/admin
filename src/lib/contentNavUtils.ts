/** Minimal nav shape for ContentView URL sync (aligned with ShellUI core NavigationItem). */
export interface AdminContentNavItem {
  label: string;
  path: string;
  url: string;
  useHashRouter?: boolean;
  /** When true, ContentView skips URL sync (e.g. Swagger/ReDoc). */
  ignoreMessages?: boolean;
}

/** Whether a URL string uses hash-based routing (e.g. contains /#/). */
export function isHashRouterUrl(url: string): boolean {
  return url.includes('/#/');
}

/** Whether a nav item uses hash-based routing (explicit flag or inferred from url). */
export function isHashRouterNavItem(item: AdminContentNavItem): boolean {
  if (item.useHashRouter === true) return true;
  if (item.useHashRouter === false) return false;
  return isHashRouterUrl(item.url);
}

/** Base URL without hash (origin + pathname before #). */
export function getBaseUrlWithoutHash(url: string): string {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return url;
  const base = url.slice(0, hashIndex);
  return base.endsWith('/') ? base : `${base}/`;
}

/** Hash path from a URL (part after #), e.g. "/themes" from "http://localhost:5173/#/themes". */
export function getHashPathFromUrl(url: string): string {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return '';
  const hash = url.slice(hashIndex + 1);
  return hash.startsWith('/') ? hash : `/${hash}`;
}

/** Path prefix for a nav item: "/" for root (path '' or '/'), otherwise "/{path}". */
export function getNavPathPrefix(item: Pick<AdminContentNavItem, 'path'>): string {
  return item.path === '' || item.path === '/' ? '/' : `/${item.path.replace(/^\/+/, '')}`;
}

/**
 * Build iframe src for a hash-router content app under the admin origin.
 * e.g. path "users", subPath "42" → `{origin}/#/users/42`
 */
export function buildAdminHashContentUrl(
  originBase: string,
  navHashPath: string,
  subPath: string,
  search = '',
): string {
  const base =
    originBase.replace(/\/+$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
  const nav = navHashPath.replace(/^\/+|\/+$/g, '');
  const sub = subPath.replace(/^\/+|\/+$/g, '');
  const segments = [nav, sub].filter(Boolean);
  const fullHashPath = segments.length === 0 ? '/' : `/${segments.join('/')}`;
  return `${base}/#${fullHashPath}${search}`;
}

/**
 * Among items that match the current pathname, return the longest matching item.
 */
export function findMatchingNavItem<T extends Pick<AdminContentNavItem, 'path'>>(
  pathname: string,
  items: T[],
): T | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  let best: T | null = null;
  let bestLen = -1;
  for (const item of items) {
    const prefix = getNavPathPrefix(item);
    const matches =
      prefix === '/'
        ? normalized === '/'
        : normalized === prefix || normalized.startsWith(`${prefix}/`);
    if (!matches) continue;
    if (prefix.length > bestLen) {
      best = item;
      bestLen = prefix.length;
    }
  }
  // Root item (path '') only matches exactly `/` above; if nothing matched and we have a root,
  // do not fall back here — caller may use a dedicated root fallback.
  if (!best && normalized !== '/') {
    const root = items.find((i) => i.path === '' || i.path === '/');
    if (root) return root;
  }
  return best;
}

/** Subpath after the nav item prefix (no leading slash). */
export function getNavSubPath(pathname: string, item: Pick<AdminContentNavItem, 'path'>): string {
  const prefix = getNavPathPrefix(item);
  if (prefix === '/') {
    return pathname.replace(/^\//, '');
  }
  if (pathname.length > prefix.length) {
    return pathname.slice(prefix.length).replace(/^\//, '');
  }
  return '';
}
