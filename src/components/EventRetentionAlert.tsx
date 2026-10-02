import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { SCHEDULED_JOBS_DOCS_URL, type EventRetentionStatus } from '@/lib/eventLogApi';

export function EventRetentionAlert({ status }: { status: EventRetentionStatus | null }) {
  const { t } = useTranslation();
  if (!status?.stale_events) return null;
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
        <p className="font-medium">{t('eventRetentionStaleTitle')}</p>
        <p>{t('eventRetentionStaleBody', { days: status.data_retention_days + 1 })}</p>
        <a
          href={SCHEDULED_JOBS_DOCS_URL}
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
