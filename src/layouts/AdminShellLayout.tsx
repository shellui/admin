import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ScrollText, Tags, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinkBase =
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors hover:no-underline';

const topNavItems = [
  { to: '/', key: 'navDashboard' as const, icon: LayoutDashboard },
] as const;

const authNavItems = [
  { to: '/users', key: 'navUsers' as const, icon: Users },
  { to: '/groups', key: 'navGroups' as const, icon: Tags },
  { to: '/login-events', key: 'navLoginEvents' as const, icon: ScrollText },
] as const;

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
        <main className="w-full min-w-0 flex-1 overflow-auto px-4 py-6 md:px-6 md:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
