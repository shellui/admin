import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useWebhookServices } from '@/features/actions/useWebhookServices';
import { resolveWebhookServiceFromPathname, webhookRulesListPath } from '@/lib/webhookRoutePaths';
import type { WebhookServiceKey } from '@/lib/webhookServices';
import { cn } from '@/lib/utils';

export function WebhookServicePicker() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const active = resolveWebhookServiceFromPathname(pathname);
  const { services } = useWebhookServices();

  if (services.length <= 1) return null;

  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label={t('webhooksServicePickerAria')}
    >
      {services.map((service) => (
        <ServiceTab
          key={service.key}
          serviceKey={service.key}
          label={t(service.labelKey)}
          active={active === service.key}
        />
      ))}
    </div>
  );
}

function ServiceTab({
  serviceKey,
  label,
  active,
}: {
  serviceKey: WebhookServiceKey;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      role="tab"
      aria-selected={active}
      to={webhookRulesListPath(serviceKey)}
      className={cn(
        'rounded-md border px-3 py-1.5 font-mono text-xs transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}
