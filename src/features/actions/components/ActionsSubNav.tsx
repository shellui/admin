import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { WEBHOOKS_DELIVERIES_PATH, WEBHOOKS_RULES_PATH } from '@/lib/webhookRoutePaths';
import { cn } from '@/lib/utils';

const RULES_PATH = WEBHOOKS_RULES_PATH;
const DELIVERIES_PATH = WEBHOOKS_DELIVERIES_PATH;

function isRulesSectionPath(pathname: string): boolean {
  if (pathname === RULES_PATH || pathname === `${RULES_PATH}/new`) return true;
  if (!pathname.startsWith(`${RULES_PATH}/`)) return false;
  return !pathname.startsWith(DELIVERIES_PATH);
}

export function ActionsSubNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const links = [
    { to: RULES_PATH, labelKey: 'actionsNavRules' as const, active: isRulesSectionPath(pathname) },
    {
      to: DELIVERIES_PATH,
      labelKey: 'actionsNavDeliveries' as const,
      active: pathname === DELIVERIES_PATH || pathname.startsWith(`${DELIVERIES_PATH}/`),
    },
  ];

  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-border/80 pb-3"
      aria-label={t('actionsSubNavAria')}
    >
      {links.map(({ to, labelKey, active }) => (
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
      ))}
    </nav>
  );
}
