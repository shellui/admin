import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Building2, KeyRound, LayoutDashboard, ScrollText, Tags, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShelluiDeveloperMode } from '@/hooks/useShelluiDeveloperMode';
import { adminShellUiConfig } from '@/admin.shellui.config';
import type { AdminNavigationItem, AdminNavigationGroup } from '@/admin.shellui.config';

const navLinkBase =
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors hover:no-underline';

type AdminNavItem = { to: string; key: string; icon: typeof LayoutDashboard };

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  '': LayoutDashboard,
  company: Building2,
  users: Users,
  groups: Tags,
  'login-events': ScrollText,
  oauth: KeyRound,
  swagger: BookOpen,
  redoc: BookOpen,
};

const mapLabelToTranslationKey = (label: string): string => {
  const normalized = label.toLowerCase();
  if (normalized === 'dashboard' || normalized === 'tableau de bord') return 'navDashboard';
  if (normalized === 'company' || normalized === 'entreprise') return 'navCompany';
  if (normalized === 'users' || normalized === 'utilisateurs') return 'navUsers';
  if (normalized === 'groups' || normalized === 'groupes') return 'navGroups';
  if (normalized === 'log events' || normalized === 'événements de connexion') return 'navLoginEvents';
  if (normalized === 'oauth apps' || normalized === 'apps oauth') return 'navOAuth';
  if (normalized === 'swagger') return 'navSwagger';
  if (normalized === 'redoc') return 'navRedoc';
  return label;
};

const toRoutePath = (path: string) => (path ? `/${path.replace(/^\/+/, '')}` : '/');

const buildNavItems = (
  navigation: (AdminNavigationItem | AdminNavigationGroup)[],
  includeDevModeItems: boolean,
): { top: AdminNavItem[]; auth: AdminNavItem[] } => {
  const top: AdminNavItem[] = [];
  const auth: AdminNavItem[] = [];

  for (const entry of navigation) {
    if ('title' in entry && 'items' in entry) {
      for (const item of entry.items) {
        if (item.requiresDevMode && !includeDevModeItems) continue;
        const key =
          typeof item.label === 'string'
            ? mapLabelToTranslationKey(item.label)
            : mapLabelToTranslationKey(item.label.en || item.label.fr || item.path);
        auth.push({ to: toRoutePath(item.path), key, icon: NAV_ICONS[item.path] ?? BookOpen });
      }
      continue;
    }
    const item = entry as AdminNavigationItem;
    if (item.requiresDevMode && !includeDevModeItems) continue;
    const key =
      typeof item.label === 'string'
        ? mapLabelToTranslationKey(item.label)
        : mapLabelToTranslationKey(item.label.en || item.label.fr || item.path);
    top.push({ to: toRoutePath(item.path), key, icon: NAV_ICONS[item.path] ?? LayoutDashboard });
  }

  return { top, auth };
};

function adminNavLinkClassName(isActive: boolean) {
  return cn(
    navLinkBase,
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-sidebar-foreground hover:bg-muted/60 hover:text-sidebar-foreground',
  );
}

export function AdminShellLayout() {
  const { t } = useTranslation();
  const isDeveloperMode = useShelluiDeveloperMode();
  const location = useLocation();
  const isDocsRoute = location.pathname === '/swagger' || location.pathname === '/redoc';
  const shellNavigation = adminShellUiConfig.navigation ?? [];
  const { top: topNavItems, auth: authNavItems } = buildNavItems(shellNavigation, isDeveloperMode);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">ShellUI</span>
            <span className="text-xs text-muted-foreground">{t('brandSubtitle')}</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Admin">
          {topNavItems.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => adminNavLinkClassName(isActive)}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {t(key)}
            </NavLink>
          ))}
          <div className="mt-4 border-t border-sidebar-border pt-3">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('navAuthGroup')}
            </p>
            <div className="flex flex-col gap-1">
              {authNavItems.map(({ to, key, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => adminNavLinkClassName(isActive)}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {t(key)}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main
          className={cn(
            'w-full min-w-0 flex-1',
            isDocsRoute ? 'overflow-hidden p-0' : 'overflow-auto px-4 py-6 md:px-6 md:py-8 lg:px-8',
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
