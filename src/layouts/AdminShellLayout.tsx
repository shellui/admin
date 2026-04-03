import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Tags, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', key: 'navDashboard' as const, icon: LayoutDashboard },
  { to: '/groups', key: 'navGroups' as const, icon: Tags },
  { to: '/users', key: 'navUsers' as const, icon: Users },
];

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
          {navItems.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground',
                )
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {t(key)}
            </NavLink>
          ))}
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
