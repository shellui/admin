import { useEffect, useMemo, useState } from 'react';
import { useWebhookServices } from '@/features/actions/useWebhookServices';
import {
  fetchEventRetention,
  type EventLogSource,
  type EventRetentionStatus,
} from '@/lib/eventLogApi';
import type { WebhookServiceKey } from '@/lib/webhookServices';

/** Event log source for `service`; `null` when the service is not configured in this shell. */
export function useEventLogSource(service: WebhookServiceKey): EventLogSource | null {
  const { getBaseUrl } = useWebhookServices();
  const baseUrl = getBaseUrl(service);
  return useMemo(() => (baseUrl ? { service, baseUrl } : null), [service, baseUrl]);
}

/** Event retention of a service; `null` while loading or when the caller may not read it. */
export function useEventRetention(
  source: EventLogSource | null,
  accessToken: string | null,
): EventRetentionStatus | null {
  const [status, setStatus] = useState<EventRetentionStatus | null>(null);

  useEffect(() => {
    setStatus(null);
    if (!accessToken || !source) return;
    let cancelled = false;
    fetchEventRetention(source, accessToken)
      .then((res) => {
        if (!cancelled) setStatus(res);
      })
      .catch(() => {
        // Non-owners get 403 and older service versions 404: nothing to report.
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, source]);

  return status;
}
