import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  isWebhooksDeliveriesSectionPath,
  isWebhooksRulesSectionPath,
  resolveWebhookServiceFromPathname,
  webhookDeliveriesPath,
  webhookRulesListPath,
} from '@/lib/webhookRoutePaths';
import { cn } from '@/lib/utils';

export function ActionsSubNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const serviceKey = resolveWebhookServiceFromPathname(pathname);

  const rulesPath = webhookRulesListPath(serviceKey);
  const deliveriesPath = webhookDeliveriesPath(serviceKey);

  const links = [
    {
      to: rulesPath,
      labelKey: 'actionsNavRules' as const,
      active: isWebhooksRulesSectionPath(pathname),
    },
    {
      to: deliveriesPath,
      labelKey: 'actionsNavDeliveries' as const,
      active: isWebhooksDeliveriesSectionPath(pathname),
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
