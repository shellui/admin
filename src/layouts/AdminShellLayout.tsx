import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContentView } from '@shellui/core/ContentView';
import type { NavigationItem } from '@shellui/core/types';
import shellui, { type ShellUIMessage } from '@shellui/sdk';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { LOADING_OVERLAY_DURATION_MS } from '@/constants/loading';
import {
  AppWindow,
  BarChart3,
  BookOpen,
  Building2,
  ChevronDown,
  ExternalLink,
  Fingerprint,
  FolderOpen,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Lock,
  ScrollText,
  Tags,
  Users,
} from 'lucide-react';
import { useShelluiAdministration } from '@/hooks/useShelluiAdministration';
import { useShelluiAuthBackendBaseUrl } from '@/hooks/useShelluiAuthBackendBaseUrl';
import { useShelluiDeveloperMode } from '@/hooks/useShelluiDeveloperMode';
import { useShelluiIsStaff } from '@/hooks/useShelluiIsStaff';
import { useShelluiStorage } from '@/hooks/useShelluiStorage';
import { useAdminContentNavigation } from '@/hooks/useAdminContentNavigation';
import type { AdminEmbedNavItem } from '@/hooks/useAdminContentNavigation';
import { resolveAdminAppUrl } from '@/lib/resolveAdminAppUrl';
import { isAdminContentFrame } from '@/lib/embed';
import { adminShellUiConfig } from '@/admin.shellui.config';
import type {
  AdminLocalizedString,
  AdminNavigationItem,
  AdminNavigationGroup,
} from '@/admin.shellui.config';
import type { SettingsAdministrationNavigationItem } from '@shellui/sdk';
import { cn } from '@/lib/utils';

const navLinkBase =
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors hover:no-underline';

function readSectionOpen(key: string, defaultOpen = true): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultOpen;
    return raw === '1';
  } catch {
    return defaultOpen;
  }
}

function writeSectionOpen(key: string, open: boolean) {
  try {
    localStorage.setItem(key, open ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}

type AdminNavItem = {
  key: string;
  icon: typeof LayoutDashboard;
  label?: string;
  /** In-app route (iframe / page). */
  to?: string;
  /** Absolute URL opened in a new tab when `openIn` is external. */
  href?: string;
  openIn?: 'default' | 'external';
};

type AdminNavGroupSection = {
  id: string;
  title: string;
  subtitle?: string | null;
  items: AdminNavItem[];
};

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  '': LayoutDashboard,
  company: Building2,
  users: Users,
  'personal-access-tokens': Fingerprint,
  groups: Tags,
  'login-events': ScrollText,
  oauth: KeyRound,
  swagger: BookOpen,
  redoc: BookOpen,
  'django-admin': Lock,
  'storage/statistics': BarChart3,
  'storage/swagger': BookOpen,
  'storage/redoc': BookOpen,
};

function resolveLocalized(label: AdminLocalizedString, language: string): string {
  if (typeof label === 'string') return label;
  return label[language] || label.en || label.fr || Object.values(label)[0] || '';
}

const mapLabelToTranslationKey = (label: string): string => {
  const normalized = label.toLowerCase();
  if (normalized === 'dashboard' || normalized === 'tableau de bord') return 'navDashboard';
  if (normalized === 'company' || normalized === 'entreprise') return 'navCompany';
  if (normalized === 'users' || normalized === 'utilisateurs') return 'navUsers';
  if (normalized === 'groups' || normalized === 'groupes') return 'navGroups';
  if (normalized === 'log events' || normalized === 'événements de connexion')
    return 'navLoginEvents';
  if (normalized === 'oauth apps' || normalized === 'apps oauth') return 'navOAuth';
  if (
    normalized === 'access tokens' ||
    normalized === "jetons d'accès" ||
    normalized === 'jetons d’accès'
  )
    return 'navAccessTokens';
  if (normalized === 'swagger') return 'navSwagger';
  if (normalized === 'redoc') return 'navRedoc';
  if (normalized === 'django admin' || normalized === 'admin django') return 'navDjangoAdmin';
  if (normalized === 'statistics' || normalized === 'statistiques') return 'navStorageStatistics';
  return label;
};

const toRoutePath = (path: string) => (path ? `/${path.replace(/^\/+/, '')}` : '/');

/** Host-configured admin apps live under `/app/...` to avoid colliding with built-in routes. */
const toCustomAppRoutePath = (path: string) => `/app/${path.replace(/^\/+/, '')}`;

function isIdentityGroup(title: string): boolean {
  const n = title.toLowerCase();
  return n === 'identity' || n === 'identité' || n === 'identite';
}

const buildNavSections = (
  navigation: (AdminNavigationItem | AdminNavigationGroup)[],
  includeDevModeItems: boolean,
  language: string,
): { top: AdminNavItem[]; groups: AdminNavGroupSection[] } => {
  const top: AdminNavItem[] = [];
  const groups: AdminNavGroupSection[] = [];

  for (const entry of navigation) {
    if ('title' in entry && 'items' in entry) {
      const title = resolveLocalized(entry.title, language);
      const items: AdminNavItem[] = [];
      for (const item of entry.items) {
        if (item.requiresDevMode && !includeDevModeItems) continue;
        const label = resolveLocalized(item.label, language);
        const key = mapLabelToTranslationKey(label);
        items.push({
          to: toRoutePath(item.path),
          key,
          icon: NAV_ICONS[item.path] ?? LayoutDashboard,
        });
      }
      groups.push({
        id: `admin-group-${entry.items[0]?.path ?? title}`,
        title,
        items,
      });
      continue;
    }
    const item = entry;
    if (item.requiresDevMode && !includeDevModeItems) continue;
    const label = resolveLocalized(item.label, language);
    const key = mapLabelToTranslationKey(label);
    top.push({ to: toRoutePath(item.path), key, icon: NAV_ICONS[item.path] ?? LayoutDashboard });
  }

  return { top, groups };
};

const buildCustomNavItems = (
  items: SettingsAdministrationNavigationItem[] | undefined,
  includeStaffItems: boolean,
  authBackendBaseUrl: string | null,
): AdminNavItem[] => {
  if (!items?.length) return [];
  return items
    .filter((item) => !item.requiresStaff || includeStaffItems)
    .map((item) => {
      const path = item.path.replace(/^\/+/, '');
      const openIn = item.openIn === 'external' ? 'external' : 'default';
      const href = resolveAdminAppUrl(item.url, authBackendBaseUrl);
      const useLockIcon =
        path === 'django-admin' ||
        path.includes('django-admin') ||
        item.url.includes('/admin') ||
        Boolean(item.requiresStaff && path.includes('django'));
      return {
        key: item.path,
        label: item.label,
        icon: useLockIcon ? Lock : AppWindow,
        openIn,
        ...(openIn === 'external' ? { href } : { to: toCustomAppRoutePath(item.path) }),
      };
    });
};

function adminNavLinkClassName(isActive: boolean) {
  return cn(
    navLinkBase,
    isActive
      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  );
}

function NavSectionHeader({
  title,
  subtitle,
  collapsible,
  open,
  onToggle,
}: {
  title: string;
  subtitle?: string | null;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  if (!collapsible) {
    return (
      <div className="px-3 pb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {subtitle ? (
          <p
            className="mt-0.5 truncate text-[11px] font-normal normal-case tracking-normal text-muted-foreground/80"
            title={subtitle}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-start gap-1 rounded-md px-3 pb-2 text-left transition-colors duration-150 hover:bg-sidebar-accent"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {subtitle ? (
          <p
            className="mt-0.5 truncate text-[11px] font-normal normal-case tracking-normal text-muted-foreground/80"
            title={subtitle}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      <ChevronDown
        className={cn(
          'mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform',
          open ? 'rotate-0' : '-rotate-90',
        )}
        aria-hidden
      />
    </button>
  );
}

function AdminSidebarLink({ item }: { item: AdminNavItem }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const text = item.label ?? t(item.key);

  if (item.openIn === 'external' && item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        title={t('navOpensExternally')}
        aria-label={`${text} (${t('navOpensExternally')})`}
        className={cn(adminNavLinkClassName(false), 'group')}
      >
        <Icon
          className="size-4 shrink-0"
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{text}</span>
        <ExternalLink
          className="size-3 shrink-0 opacity-40 transition-opacity duration-150 group-hover:opacity-70"
          aria-hidden
        />
      </a>
    );
  }

  if (!item.to) return null;

  return (
    <NavLink
      to={item.to}
      end
      className={({ isActive }) => adminNavLinkClassName(isActive)}
    >
      <Icon
        className="size-4 shrink-0"
        aria-hidden
      />
      {text}
    </NavLink>
  );
}

function CollapsibleNavGroup({
  section,
  storageKey,
}: {
  section: AdminNavGroupSection;
  storageKey: string;
}) {
  const [open, setOpen] = useState(() => readSectionOpen(storageKey));

  useEffect(() => {
    writeSectionOpen(storageKey, open);
  }, [open, storageKey]);

  if (section.items.length === 0) return null;

  return (
    <div className="mt-4 border-t border-sidebar-border pt-3">
      <NavSectionHeader
        title={section.title}
        subtitle={section.subtitle}
        collapsible
        open={open}
        onToggle={() => setOpen((prev) => !prev)}
      />
      {open ? (
        <div className="flex flex-col gap-1">
          {section.items.map((item) => (
            <AdminSidebarLink
              key={item.to ?? item.key}
              item={item}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getHashFragment(url: string): string {
  const idx = url.indexOf('#');
  if (idx === -1) return '#/';
  const fragment = url.slice(idx);
  return fragment === '#' ? '#/' : fragment;
}

function normalizeHash(hash: string | undefined | null): string {
  if (!hash) return '#/';
  const withHash = hash.startsWith('#') ? hash : `#${hash}`;
  return withHash === '#' ? '#/' : withHash;
}

function softNavigateIframeHash(iframe: HTMLIFrameElement, targetUrl: string): boolean {
  try {
    const win = iframe.contentWindow;
    if (!win) return false;
    const loc = win.location;
    // Setting hash on about:blank cancels the pending src navigation and leaves a blank frame.
    if (!loc.href || loc.href === 'about:blank' || loc.origin === 'null') return false;
    if (loc.origin !== window.location.origin) return false;
    const nextHash = getHashFragment(targetUrl);
    if (loc.hash !== nextHash) {
      loc.hash = nextHash;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Stable ContentView mount: does not re-render when chrome hash updates from in-iframe navigation.
 * Shows the loading bar until the nested frame initializes (core starts isLoading=false when
 * ignoreMessages is false, so the overlay would otherwise be easy to miss).
 */
const StableAdminHashContentView = memo(function StableAdminHashContentView({
  initialUrl,
  navItem,
}: {
  initialUrl: string;
  navItem: NavigationItem;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const off = shellui.addMessageListener(
      'SHELLUI_INITIALIZED',
      (_data: ShellUIMessage, event: MessageEvent) => {
        const iframe = wrapRef.current?.querySelector('iframe');
        if (!iframe || event.source !== iframe.contentWindow) return;
        setIsLoading(false);
      },
    );
    const timeoutId = window.setTimeout(() => setIsLoading(false), LOADING_OVERLAY_DURATION_MS);
    return () => {
      off();
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full min-h-0"
    >
      <ContentView
        url={initialUrl}
        pathPrefix=""
        navItem={navItem}
      />
      {isLoading ? <LoadingOverlay /> : null}
    </div>
  );
});

/**
 * One ContentView for all same-origin hash pages.
 * - In-iframe route changes only sync the chrome URL (no ContentView remount / soft-nav).
 * - Sidebar chrome navigations soft-update the iframe hash without remounting.
 */
function AdminHashContentFrame({
  targetUrl,
  navItem,
}: {
  targetUrl: string;
  navItem: NavigationItem;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialUrlRef = useRef(targetUrl);
  const skipFirstSoftNavRef = useRef(true);
  /** Hash last reported by the content iframe — chrome updates from that must not soft-nav. */
  const lastIframeHashRef = useRef<string | null>(null);

  // Register before ContentView's useEffect listeners so we record iframe hash first.
  useLayoutEffect(() => {
    const off = shellui.addMessageListener(
      'SHELLUI_URL_CHANGED',
      (data: ShellUIMessage, event: MessageEvent) => {
        const iframe = containerRef.current?.querySelector('iframe');
        if (!iframe || event.source !== iframe.contentWindow) return;
        const hash = (data.payload as { hash?: string } | undefined)?.hash;
        lastIframeHashRef.current = normalizeHash(hash);
      },
    );
    return off;
  }, []);

  useLayoutEffect(() => {
    const iframe = containerRef.current?.querySelector('iframe');
    if (!iframe) return;

    const targetHash = getHashFragment(targetUrl);

    if (skipFirstSoftNavRef.current) {
      skipFirstSoftNavRef.current = false;
      if (getHashFragment(initialUrlRef.current) === targetHash) {
        return;
      }
    }

    // Chrome URL was updated from the iframe — do not push hash back in (avoids churn).
    if (lastIframeHashRef.current === targetHash) {
      return;
    }

    if (softNavigateIframeHash(iframe, targetUrl)) return;

    const onLoad = () => {
      if (lastIframeHashRef.current === getHashFragment(targetUrl)) return;
      softNavigateIframeHash(iframe, targetUrl);
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [targetUrl]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full min-h-0"
    >
      <StableAdminHashContentView
        initialUrl={initialUrlRef.current}
        navItem={navItem}
      />
    </div>
  );
}

/**
 * Stable ContentView for a single external admin app (e.g. playground on :4001).
 * Subpath changes only sync the chrome URL — iframe src / ContentView props stay fixed.
 */
const StableExternalContentView = memo(function StableExternalContentView({
  initialUrl,
  navItem,
  pathPrefix,
  ignoreMessages,
}: {
  initialUrl: string;
  navItem: NavigationItem;
  pathPrefix: string;
  ignoreMessages: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const off = shellui.addMessageListener(
      'SHELLUI_INITIALIZED',
      (_data: ShellUIMessage, event: MessageEvent) => {
        const iframe = wrapRef.current?.querySelector('iframe');
        if (!iframe || event.source !== iframe.contentWindow) return;
        setIsLoading(false);
      },
    );
    const timeoutId = window.setTimeout(() => setIsLoading(false), LOADING_OVERLAY_DURATION_MS);
    return () => {
      off();
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full min-h-0"
    >
      <ContentView
        url={initialUrl}
        pathPrefix={pathPrefix}
        navItem={navItem}
        ignoreMessages={ignoreMessages}
      />
      {isLoading ? <LoadingOverlay /> : null}
    </div>
  );
});

/**
 * One ContentView per external app path. Remounts only when switching apps (parent key),
 * not when the chrome route is a subpath of the same app.
 */
function AdminExternalContentFrame({
  targetUrl,
  baseUrl,
  pathPrefix,
  currentItem,
}: {
  targetUrl: string;
  baseUrl: string;
  pathPrefix: string;
  currentItem: AdminEmbedNavItem;
}) {
  // Deep-link on first mount; never update src when only the subpath changes.
  const initialUrlRef = useRef(targetUrl);
  const navItem = useMemo<NavigationItem>(
    () => ({
      label: currentItem.label,
      path: pathPrefix,
      url: currentItem.useHashRouter
        ? currentItem.url.includes('#')
          ? currentItem.url
          : `${baseUrl.replace(/\/+$/, '')}/#/`
        : baseUrl,
      useHashRouter: currentItem.useHashRouter === true,
    }),
    [baseUrl, currentItem.label, currentItem.url, currentItem.useHashRouter, pathPrefix],
  );

  return (
    <StableExternalContentView
      initialUrl={initialUrlRef.current}
      navItem={navItem}
      pathPrefix={pathPrefix}
      ignoreMessages={Boolean(currentItem.ignoreMessages)}
    />
  );
}

function AdminChromeMain() {
  const frame = useAdminContentNavigation();

  if (frame.kind === 'none') {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        Not found
      </div>
    );
  }

  if (frame.kind === 'admin-hash') {
    return (
      <AdminHashContentFrame
        targetUrl={frame.targetUrl}
        navItem={frame.navItem as NavigationItem}
      />
    );
  }

  return (
    <AdminExternalContentFrame
      key={frame.currentItem.path}
      targetUrl={frame.targetUrl}
      baseUrl={frame.baseUrl}
      pathPrefix={frame.pathPrefix}
      currentItem={frame.currentItem}
    />
  );
}

function AdminContentMain() {
  const location = useLocation();
  const isFullBleed =
    location.pathname.startsWith('/app/') ||
    location.pathname === '/storage' ||
    location.pathname === '/storage/swagger' ||
    location.pathname === '/storage/redoc' ||
    location.pathname === '/swagger' ||
    location.pathname === '/redoc';

  return (
    <main
      className={cn(
        'h-full w-full min-w-0 flex-1',
        isFullBleed ? 'overflow-hidden p-0' : 'overflow-auto px-4 py-6 md:px-6 md:py-8 lg:px-8',
      )}
    >
      <Outlet />
    </main>
  );
}

export function AdminShellLayout() {
  const { t, i18n } = useTranslation();
  const isDeveloperMode = useShelluiDeveloperMode();
  const isStaff = useShelluiIsStaff();
  const administration = useShelluiAdministration();
  const storage = useShelluiStorage();
  const authBackendBaseUrl = useShelluiAuthBackendBaseUrl();
  const contentFrame = isAdminContentFrame();
  const shellNavigation = adminShellUiConfig.navigation ?? [];
  const { top: topNavItems, groups } = buildNavSections(
    shellNavigation,
    isDeveloperMode,
    i18n.language,
  );
  const storageUrl = storage?.url?.trim().replace(/\/+$/, '') || null;
  const filesUrl = storage?.filesUrl?.trim() || null;
  const customNavItems = buildCustomNavItems(
    administration?.navigation,
    isStaff,
    authBackendBaseUrl,
  );
  const customSectionTitle = administration?.title?.trim() || t('navApplicationsGroup');
  const djangoAdminHref = authBackendBaseUrl
    ? resolveAdminAppUrl('/admin/', authBackendBaseUrl)
    : null;
  const storageDjangoAdminHref = storageUrl ? `${storageUrl}/admin/` : null;

  const groupSections = useMemo(() => {
    const sections = groups.map((group) => {
      if (isIdentityGroup(group.title)) {
        const items = [...group.items];
        if (isStaff && djangoAdminHref) {
          items.push({
            key: 'navDjangoAdmin',
            icon: Lock,
            label: t('navDjangoAdmin'),
            openIn: 'external',
            href: djangoAdminHref,
          });
        }
        return {
          ...group,
          title: t('navAuthGroup'),
          subtitle: authBackendBaseUrl,
          items,
        };
      }
      return group;
    });

    if (storageUrl) {
      const storageItems: AdminNavItem[] = [];
      if (filesUrl) {
        storageItems.push({
          key: 'navStorageFiles',
          icon: FolderOpen,
          label: t('navStorageFiles'),
          to: '/storage',
        });
      }
      storageItems.push({
        key: 'navStorageStatistics',
        icon: BarChart3,
        label: t('navStorageStatistics'),
        to: '/storage/statistics',
      });
      if (isDeveloperMode) {
        storageItems.push(
          {
            key: 'navStorageSwagger',
            icon: BookOpen,
            label: t('navSwagger'),
            to: '/storage/swagger',
          },
          {
            key: 'navStorageRedoc',
            icon: BookOpen,
            label: t('navRedoc'),
            to: '/storage/redoc',
          },
        );
      }
      if (isStaff && storageDjangoAdminHref) {
        storageItems.push({
          key: 'navStorageDjangoAdmin',
          icon: HardDrive,
          label: t('navStorageDjangoAdmin'),
          openIn: 'external',
          href: storageDjangoAdminHref,
        });
      }
      sections.push({
        id: 'admin-storage',
        title: t('navStorageGroup'),
        subtitle: storageUrl,
        items: storageItems,
      });
    }

    return sections;
  }, [
    authBackendBaseUrl,
    djangoAdminHref,
    filesUrl,
    groups,
    isDeveloperMode,
    isStaff,
    storageDjangoAdminHref,
    storageUrl,
    t,
  ]);

  // Nested same-origin iframe: page content only (no sidebar).
  if (contentFrame) {
    return (
      <div className="flex h-screen min-h-0 w-full flex-col bg-background">
        <AdminContentMain />
      </div>
    );
  }

  // Chrome: sidebar + ContentView for every menu.
  return (
    <div className="flex h-screen min-h-0 w-full bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <nav
          className="flex flex-1 flex-col gap-1 overflow-auto p-3"
          aria-label="Admin"
        >
          {topNavItems.map((item) => (
            <AdminSidebarLink
              key={item.to ?? item.key}
              item={item}
            />
          ))}
          {customNavItems.length > 0 && (
            <div
              className={cn(topNavItems.length > 0 && 'mt-4 border-t border-sidebar-border pt-3')}
            >
              <NavSectionHeader title={customSectionTitle} />
              <div className="flex flex-col gap-1">
                {customNavItems.map((item) => (
                  <AdminSidebarLink
                    key={item.key}
                    item={item}
                  />
                ))}
              </div>
            </div>
          )}
          {groupSections.map((section) => (
            <CollapsibleNavGroup
              key={section.id}
              section={section}
              storageKey={section.id}
            />
          ))}
        </nav>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="h-full w-full min-w-0 flex-1 overflow-hidden p-0">
          <AdminChromeMain />
        </main>
      </div>
    </div>
  );
}
