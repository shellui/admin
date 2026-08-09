import { useShelluiAdministration } from '@/hooks/useShelluiAdministration';
import { useShelluiAuthBackendBaseUrl } from '@/hooks/useShelluiAuthBackendBaseUrl';
import { useShelluiDeveloperMode } from '@/hooks/useShelluiDeveloperMode';
import { useShelluiIsStaff } from '@/hooks/useShelluiIsStaff';
import { useShelluiStorage } from '@/hooks/useShelluiStorage';
import { resolveAdminAppUrl } from '@/lib/resolveAdminAppUrl';
import { adminShellUiConfig } from '@/admin.shellui.config';
import type {
  AdminLocalizedString,
  AdminNavigationItem,
  AdminNavigationGroup,
} from '@/admin.shellui.config';
import type { SettingsAdministrationNavigationItem } from '@shellui/sdk';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppWindow,
  BarChart3,
  BookOpen,
  Building2,
  ChevronDown,
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
      ? 'bg-primary text-primary-foreground'
      : 'text-sidebar-foreground hover:bg-muted/60 hover:text-sidebar-foreground',
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
      className="flex w-full items-start gap-1 rounded-md px-3 pb-2 text-left hover:bg-muted/40"
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
        className={adminNavLinkClassName(false)}
      >
        <Icon
          className="size-4 shrink-0"
          aria-hidden
        />
        {text}
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

export function AdminShellLayout() {
  const { t, i18n } = useTranslation();
  const isDeveloperMode = useShelluiDeveloperMode();
  const isStaff = useShelluiIsStaff();
  const administration = useShelluiAdministration();
  const storage = useShelluiStorage();
  const authBackendBaseUrl = useShelluiAuthBackendBaseUrl();
  const location = useLocation();
  const isDocsRoute = location.pathname === '/swagger' || location.pathname === '/redoc';
  const isIframeContentRoute =
    location.pathname.startsWith('/app/') || location.pathname === '/storage';
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
    isStaff,
    storageDjangoAdminHref,
    storageUrl,
    t,
  ]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <nav
          className="flex flex-1 flex-col gap-1 p-3"
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
      <div className="flex min-w-0 flex-1 flex-col">
        <main
          className={cn(
            'w-full min-w-0 flex-1',
            isDocsRoute || isIframeContentRoute
              ? 'overflow-hidden p-0'
              : 'overflow-auto px-4 py-6 md:px-6 md:py-8 lg:px-8',
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
