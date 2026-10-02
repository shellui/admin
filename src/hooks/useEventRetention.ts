import { useEffect, useState } from 'react';
import { fetchEventRetention, type EventRetentionStatus } from '@/lib/eventLogApi';

/** Company event retention; `null` while loading or when the caller may not read it. */
export function useEventRetention(accessToken: string | null): EventRetentionStatus | null {
  const [status, setStatus] = useState<EventRetentionStatus | null>(null);

  useEffect(() => {
    setStatus(null);
    if (!accessToken) return;
    let cancelled = false;
    fetchEventRetention(accessToken)
      .then((res) => {
        if (!cancelled) setStatus(res);
      })
      .catch(() => {
        // Non-owners get 403 and older identity-service versions 404: nothing to report.
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return status;
}
