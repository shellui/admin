import { getUnlabeled, parsePrometheusSamples } from '@/lib/prometheusText';

export const EMAIL_METRIC_NAMES = {
  queueDepth: 'shellui_email_queue_depth',
  queueAge: 'shellui_email_queue_oldest_age_seconds',
  latency: 'shellui_email_send_latency_seconds',
  providerErrors: 'shellui_email_provider_errors',
  authTtlExpiries: 'shellui_email_auth_ttl_expiries',
} as const;

export const EMAIL_LANES = ['auth', 'transactional', 'bulk'] as const;

export type EmailMetricsSnapshot = {
  queueDepth: Record<string, number>;
  queueAgeSeconds: Record<string, number>;
  latency: Record<string, { p50: number; p95: number }>;
  providerErrors: Array<{ provider: string; errorCode: string; count: number }>;
  authTtlExpiries: number;
};

function readLabels(lhs: string): { name: string; labels: Record<string, string> } | null {
  const brace = lhs.indexOf('{');
  if (brace === -1) return { name: lhs, labels: {} };
  if (!lhs.endsWith('}')) return null;
  const name = lhs.slice(0, brace);
  const body = lhs.slice(brace + 1, -1);
  const labels: Record<string, string> = {};
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) {
    labels[match[1]] = match[2].replace(/\\"/g, '"');
  }
  return { name, labels };
}

export function parseEmailMetrics(text: string): EmailMetricsSnapshot {
  const samples = parsePrometheusSamples(text);
  const queueDepth: Record<string, number> = {};
  const queueAgeSeconds: Record<string, number> = {};
  const latency: Record<string, { p50: number; p95: number }> = {};
  const providerErrors: EmailMetricsSnapshot['providerErrors'] = [];

  for (const lane of EMAIL_LANES) {
    queueDepth[lane] = 0;
    queueAgeSeconds[lane] = 0;
    latency[lane] = { p50: 0, p95: 0 };
  }

  for (const [lhs, value] of samples) {
    const parsed = readLabels(lhs);
    if (!parsed) continue;
    if (parsed.name === EMAIL_METRIC_NAMES.queueDepth && parsed.labels.lane) {
      queueDepth[parsed.labels.lane] = value;
    } else if (parsed.name === EMAIL_METRIC_NAMES.queueAge && parsed.labels.lane) {
      queueAgeSeconds[parsed.labels.lane] = value;
    } else if (parsed.name === EMAIL_METRIC_NAMES.latency && parsed.labels.lane) {
      const lane = parsed.labels.lane;
      const row = latency[lane] ?? { p50: 0, p95: 0 };
      if (parsed.labels.quantile === '0.5') row.p50 = value;
      if (parsed.labels.quantile === '0.95') row.p95 = value;
      latency[lane] = row;
    } else if (parsed.name === EMAIL_METRIC_NAMES.providerErrors) {
      providerErrors.push({
        provider: parsed.labels.provider || 'unknown',
        errorCode: parsed.labels.error_code || '',
        count: value,
      });
    }
  }

  providerErrors.sort((a, b) => b.count - a.count || a.provider.localeCompare(b.provider));

  return {
    queueDepth,
    queueAgeSeconds,
    latency,
    providerErrors,
    authTtlExpiries: getUnlabeled(samples, EMAIL_METRIC_NAMES.authTtlExpiries) ?? 0,
  };
}
