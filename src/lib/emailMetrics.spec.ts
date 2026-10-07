import { describe, expect, it } from 'vitest';
import { parseEmailMetrics } from '@/lib/emailMetrics';

describe('parseEmailMetrics', () => {
  it('reads queue, latency, provider errors, and auth TTL expiries', () => {
    const text = `
# TYPE shellui_email_queue_depth gauge
shellui_email_queue_depth{lane="auth"} 2
shellui_email_queue_depth{lane="transactional"} 0
shellui_email_queue_depth{lane="bulk"} 0
shellui_email_queue_oldest_age_seconds{lane="auth"} 15
shellui_email_queue_oldest_age_seconds{lane="transactional"} 0
shellui_email_queue_oldest_age_seconds{lane="bulk"} 0
shellui_email_send_latency_seconds{lane="auth",quantile="0.5"} 0.4
shellui_email_send_latency_seconds{lane="auth",quantile="0.95"} 1.2
shellui_email_provider_errors{provider="resend",error_code="timeout"} 3
shellui_email_auth_ttl_expiries 4
`.trim();
    const snapshot = parseEmailMetrics(text);
    expect(snapshot.queueDepth.auth).toBe(2);
    expect(snapshot.queueAgeSeconds.auth).toBe(15);
    expect(snapshot.queueDepth.bulk).toBe(0);
    expect(snapshot.latency.auth).toEqual({ p50: 0.4, p95: 1.2 });
    expect(snapshot.providerErrors).toEqual([
      { provider: 'resend', errorCode: 'timeout', count: 3 },
    ]);
    expect(snapshot.authTtlExpiries).toBe(4);
  });
});
