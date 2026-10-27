import type { ReactNode } from 'react';
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

export function ActionsSubNav({
  rulesCount,
  aside,
}: { rulesCount?: number; aside?: ReactNode } = {}) {
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
    <div className="flex flex-wrap items-end gap-3 border-b border-border">
      <nav
        className="-mb-px flex gap-1"
        aria-label={t('actionsSubNavAria')}
      >
        {links.map(({ to, labelKey, active }) => (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium no-underline transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(labelKey)}
            {labelKey === 'actionsNavRules' && rulesCount != null ? (
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                {rulesCount}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
      {aside ? <div className="mb-2 ml-auto">{aside}</div> : null}
    </div>
  );
}
