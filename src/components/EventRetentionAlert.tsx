import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useEventLogSource, useEventRetention } from '@/hooks/useEventRetention';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { RETENTION_DOCS_URL, type EventRetentionStatus } from '@/lib/eventLogApi';
import { WEBHOOK_SERVICE_KEYS, type WebhookServiceKey } from '@/lib/webhookServices';

const SERVICE_LABEL_KEY = {
  identity: 'webhooksServiceIdentity',
  hosting: 'webhooksServiceHosting',
  storage: 'webhooksServiceStorage',
} as const satisfies Record<WebhookServiceKey, string>;

export function EventRetentionAlert({
  service,
  status,
}: {
  service: WebhookServiceKey;
  status: EventRetentionStatus | null;
}) {
  const { t } = useTranslation();
  if (!status?.stale_events) return null;
  const days = status.data_retention_days + 1;
  const serviceLabel = t(SERVICE_LABEL_KEY[service]);
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0"
        aria-hidden
      />
      <div className="space-y-1">
        <p className="font-medium">{t('eventRetentionStaleTitle', { service: serviceLabel })}</p>
        <p>
          {service === 'identity'
            ? t('eventRetentionStaleBody', { days })
            : t('eventRetentionStaleBodyService', { days, service: serviceLabel })}
        </p>
        <a
          href={RETENTION_DOCS_URL[service]}
          target="_blank"
          rel="noreferrer"
          className="inline-block font-medium underline underline-offset-2"
        >
          {t('eventRetentionStaleLink')}
        </a>
      </div>
    </div>
  );
}

function ServiceRetentionAlert({ service }: { service: WebhookServiceKey }) {
  const accessToken = useShelluiAccessToken();
  const status = useEventRetention(useEventLogSource(service), accessToken);
  return (
    <EventRetentionAlert
      service={service}
      status={status}
    />
  );
}

/** One alert per configured service whose purge job is not running. */
export function AllServicesRetentionAlerts() {
  return (
    <>
      {WEBHOOK_SERVICE_KEYS.map((service) => (
        <ServiceRetentionAlert
          key={service}
          service={service}
        />
      ))}
    </>
  );
}
