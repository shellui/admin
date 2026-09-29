import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/actions/rules', labelKey: 'actionsNavRules' as const },
  { to: '/actions/deliveries', labelKey: 'actionsNavDeliveries' as const },
];

export function ActionsSubNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-border/80 pb-3"
      aria-label={t('actionsSubNavAria')}
    >
      {LINKS.map(({ to, labelKey }) => {
        const active = pathname === to || pathname.startsWith(`${to}/`);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'rounded-md px-3 py-1.5 font-mono text-xs transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
