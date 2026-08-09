import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { adminShellUiConfig } from '@/admin.shellui.config';
import type { AdminNavigationItem, AdminNavigationGroup } from '@/admin.shellui.config';
import { useShelluiAdministration } from '@/hooks/useShelluiAdministration';
import { useShelluiAuthBackendBaseUrl } from '@/hooks/useShelluiAuthBackendBaseUrl';
import { useShelluiDeveloperMode } from '@/hooks/useShelluiDeveloperMode';
import { useShelluiIsStaff } from '@/hooks/useShelluiIsStaff';
import { useShelluiStorage } from '@/hooks/useShelluiStorage';
import { getAuthBackendBaseUrl } from '@/lib/backendUrl';
import { resolveAdminAppUrl } from '@/lib/resolveAdminAppUrl';
import {
  type AdminContentNavItem,
  buildAdminHashContentUrl,
  findMatchingNavItem,
  getBaseUrlWithoutHash,
  getNavPathPrefix,
  getNavSubPath,
} from '@/lib/contentNavUtils';

export type AdminEmbedNavItem = AdminContentNavItem & {
  /** Absolute URL loaded in the chrome ContentView iframe. */
  embedUrl: string;
  ignoreMessages?: boolean;
};

export type AdminContentFrame =
  | {
      kind: 'admin-hash';
      /** Full hash URL for the current chrome route (e.g. origin/#/users). */
      targetUrl: string;
      /** Stable ContentView nav item — one iframe for all in-app hash pages. */
      navItem: AdminEmbedNavItem;
    }
  | {
      kind: 'external';
      /** Stable nav item from embedItems (same reference across subpath changes). */
      currentItem: AdminEmbedNavItem;
      /** Base embed URL only — never includes subpath (avoids iframe remount). */
      baseUrl: string;
      /** Full URL including subpath — used once for deep-link initial load. */
      targetUrl: string;
      pathPrefix: string;
    }
  | { kind: 'none' };

function flattenBuiltInItems(
  navigation: (AdminNavigationItem | AdminNavigationGroup)[],
  includeDevModeItems: boolean,
): AdminNavigationItem[] {
  const out: AdminNavigationItem[] = [];
  for (const entry of navigation) {
    if ('title' in entry && 'items' in entry) {
      for (const item of entry.items) {
        if (item.requiresDevMode && !includeDevModeItems) continue;
        out.push(item);
      }
      continue;
    }
    if (entry.requiresDevMode && !includeDevModeItems) continue;
    out.push(entry);
  }
  return out;
}

function adminOriginBase(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname.replace(/\/+$/, '') || ''}`;
}

/** Built-in admin pages are same-origin hash content; custom apps (e.g. :4001) are external. */
function isSameOriginAdminEmbed(embedUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const base = getBaseUrlWithoutHash(embedUrl) || embedUrl;
    return new URL(base, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Resolves the current admin hash location to a ContentView frame.
 * Same-origin hash pages share one iframe (soft hash updates); external embeds remount per item.
 */
export function useAdminContentNavigation(): AdminContentFrame {
  const location = useLocation();
  const isDeveloperMode = useShelluiDeveloperMode();
  const isStaff = useShelluiIsStaff();
  const administration = useShelluiAdministration();
  const storage = useShelluiStorage();
  const authBackendBaseUrl = useShelluiAuthBackendBaseUrl();

  const embedItems = useMemo(() => {
    const items: AdminEmbedNavItem[] = [];
    const origin = adminOriginBase();

    for (const item of flattenBuiltInItems(adminShellUiConfig.navigation ?? [], isDeveloperMode)) {
      const path = item.path.replace(/^\/+/, '');
      if (path === 'swagger' || path === 'redoc') {
        const base = getAuthBackendBaseUrl();
        const docsUrl = path === 'swagger' ? `${base}/api/docs/` : `${base}/api/docs/redoc/`;
        items.push({
          label: typeof item.label === 'string' ? item.label : item.label.en,
          path,
          url: docsUrl,
          embedUrl: docsUrl,
          ignoreMessages: true,
          useHashRouter: false,
        });
        continue;
      }
      const hashUrl = buildAdminHashContentUrl(origin, path, '', '');
      items.push({
        label: typeof item.label === 'string' ? item.label : item.label.en,
        path,
        url: hashUrl,
        embedUrl: hashUrl,
        useHashRouter: true,
      });
    }

    for (const item of administration?.navigation ?? []) {
      if (item.requiresStaff && !isStaff) continue;
      if (item.openIn === 'external') continue;
      const path = `app/${item.path.replace(/^\/+/, '')}`;
      const embedUrl = resolveAdminAppUrl(item.url, authBackendBaseUrl);
      // Custom admin apps are typically hash-router SPAs (e.g. playground on :4001).
      const hashRouter = embedUrl.includes('#');
      items.push({
        label: item.label,
        path,
        url: hashRouter ? embedUrl : `${embedUrl.replace(/\/+$/, '')}/#/`,
        embedUrl,
        useHashRouter: true,
      });
    }

    const storageUrl = storage?.url?.trim().replace(/\/+$/, '') || null;
    const filesUrl = storage?.filesUrl?.trim() || null;
    if (storageUrl) {
      if (filesUrl) {
        items.push({
          label: 'Files',
          path: 'storage',
          url: filesUrl,
          embedUrl: filesUrl,
          useHashRouter: false,
        });
      }
      const statsHash = buildAdminHashContentUrl(origin, 'storage/statistics', '', '');
      items.push({
        label: 'Statistics',
        path: 'storage/statistics',
        url: statsHash,
        embedUrl: statsHash,
        useHashRouter: true,
      });
      if (isDeveloperMode) {
        const swaggerUrl = `${storageUrl}/api/docs/`;
        const redocUrl = `${storageUrl}/api/docs/redoc/`;
        items.push(
          {
            label: 'Swagger',
            path: 'storage/swagger',
            url: swaggerUrl,
            embedUrl: swaggerUrl,
            ignoreMessages: true,
            useHashRouter: false,
          },
          {
            label: 'ReDoc',
            path: 'storage/redoc',
            url: redocUrl,
            embedUrl: redocUrl,
            ignoreMessages: true,
            useHashRouter: false,
          },
        );
      }
    }

    return items;
  }, [
    administration?.navigation,
    authBackendBaseUrl,
    isDeveloperMode,
    isStaff,
    storage?.filesUrl,
    storage?.url,
  ]);

  const stableHashNavItem = useMemo<AdminEmbedNavItem>(() => {
    const origin = adminOriginBase();
    const rootUrl = buildAdminHashContentUrl(origin, '', '', '');
    return {
      label: 'Admin',
      path: '',
      url: `${getBaseUrlWithoutHash(rootUrl).replace(/\/+$/, '')}/#/`,
      embedUrl: rootUrl,
      useHashRouter: true,
    };
  }, []);

  return useMemo(() => {
    const pathname = location.pathname.replace(/\/+$/, '') || '/';
    const search = location.search || '';
    const matched = findMatchingNavItem(pathname, embedItems);

    if (!matched) {
      return { kind: 'none' };
    }

    const subPath = getNavSubPath(pathname, matched);
    const pathPrefix = getNavPathPrefix(matched).replace(/^\//, '');

    // Same-origin built-in pages share one admin-hash ContentView.
    // External apps (playground, files, docs) — even hash-router ones — stay on kind:external.
    if (matched.useHashRouter && isSameOriginAdminEmbed(matched.embedUrl)) {
      const origin = adminOriginBase();
      const targetUrl = buildAdminHashContentUrl(origin, matched.path, subPath, search);
      return {
        kind: 'admin-hash',
        targetUrl,
        navItem: stableHashNavItem,
      };
    }

    let targetUrl = matched.embedUrl;
    if (matched.useHashRouter) {
      const base = getBaseUrlWithoutHash(matched.url || matched.embedUrl).replace(/\/+$/, '');
      const hashPath = subPath ? `/${subPath}` : '/';
      targetUrl = `${base}/#${hashPath}${search}`;
    } else if (subPath && !matched.ignoreMessages) {
      const base = matched.embedUrl.endsWith('/') ? matched.embedUrl : `${matched.embedUrl}/`;
      targetUrl = `${base}${subPath}${search}`;
    } else if (search && !matched.ignoreMessages) {
      const join = matched.embedUrl.includes('?') ? '&' : '?';
      targetUrl = `${matched.embedUrl}${search.replace(/^\?/, join)}`;
    }

    return {
      kind: 'external',
      currentItem: matched,
      baseUrl: matched.embedUrl,
      targetUrl,
      pathPrefix: matched.path === '' || matched.path === '/' ? '' : pathPrefix,
    };
  }, [embedItems, location.pathname, location.search, stableHashNavItem]);
}
