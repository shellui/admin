import { parsePrometheusSamples } from '@/lib/prometheusText';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

export const SHELLUI_STORAGE_METRIC_NAMES = {
  objectsTotal: 'shellui_storage_objects_total',
  bytesTotal: 'shellui_storage_bytes_total',
  bucketsTotal: 'shellui_storage_buckets_total',
  documentsTotal: 'shellui_storage_documents_total',
  documentBytes: 'shellui_storage_document_bytes',
  uploads24h: 'shellui_storage_uploads_24h',
  uploads7d: 'shellui_storage_uploads_7d',
  uploads30d: 'shellui_storage_uploads_30d',
  bytes7d: 'shellui_storage_bytes_7d',
  quotaUsedBytes: 'shellui_storage_quota_used_bytes',
  quotaMaxBytes: 'shellui_storage_quota_max_bytes',
} as const;

export type StorageMetricsSnapshot = {
  rawText: string;
  objectsTotal: number;
  bytesTotal: number;
  bucketsTotal: number;
  documentsTotal: number;
  documentBytes: number;
  uploads24h: number;
  uploads7d: number;
  uploads30d: number;
  bytes7d: number;
  quotaUsedBytes: number;
  quotaMaxBytes: number;
};

function readCompanySeries(
  samples: Map<string, number>,
  metricName: string,
  companyId: number,
): number {
  const key = `${metricName}{company_id="${companyId}"}`;
  const v = samples.get(key);
  if (v === undefined || !Number.isFinite(v)) {
    throw new Error(`Missing metric ${key} in exposition`);
  }
  return v;
}

function parseErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === 'string') return o.detail;
  if (typeof o.error === 'string') return o.error;
  if (typeof o.message === 'string') return o.message;
  return null;
}

export function buildStoragePrometheusMetricsUrl(storageBaseUrl: string): string {
  return `${storageBaseUrl.replace(/\/+$/, '')}/storage/v1/metrics`;
}

export function formatBytes(n: number): string {
  const sign = n < 0 ? '-' : '';
  let value = Math.abs(n);
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  if (unit === 0) return `${sign}${Math.round(Math.abs(n))} ${units[0]}`;
  return `${sign}${value.toFixed(1)} ${units[unit]}`;
}

/** Prometheus text from storage-service `GET /storage/v1/metrics` (staff or company owner). */
export async function fetchStoragePrometheusMetrics(
  storageBaseUrl: string,
  accessToken: string,
): Promise<string> {
  const res = await fetch(buildStoragePrometheusMetricsUrl(storageBaseUrl), {
    headers: {
      Accept: 'text/plain',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const ct = res.headers.get('Content-Type') || '';
  if (!res.ok) {
    let msg: string | null = null;
    if (ct.includes('application/json') || ct.includes('text/plain')) {
      if (ct.includes('application/json')) {
        const body = await res.json().catch(() => null);
        msg = parseErrorMessage(body);
      } else {
        const text = await res.text().catch(() => '');
        try {
          msg = parseErrorMessage(JSON.parse(text));
        } catch {
          msg = text.trim() || null;
        }
      }
    } else {
      const text = await res.text().catch(() => '');
      msg = text.trim() || null;
    }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.text();
}

export async function fetchStorageMetricsSnapshot(
  storageBaseUrl: string,
  accessToken: string,
): Promise<StorageMetricsSnapshot> {
  const companyId = getCompanyIdFromJwt(accessToken);
  if (!companyId) {
    throw new Error('Missing company_id in access token.');
  }
  const rawText = await fetchStoragePrometheusMetrics(storageBaseUrl, accessToken);
  const samples = parsePrometheusSamples(rawText);
  return {
    rawText,
    objectsTotal: readCompanySeries(samples, SHELLUI_STORAGE_METRIC_NAMES.objectsTotal, companyId),
    bytesTotal: readCompanySeries(samples, SHELLUI_STORAGE_METRIC_NAMES.bytesTotal, companyId),
    bucketsTotal: readCompanySeries(samples, SHELLUI_STORAGE_METRIC_NAMES.bucketsTotal, companyId),
    documentsTotal: readCompanySeries(
      samples,
      SHELLUI_STORAGE_METRIC_NAMES.documentsTotal,
      companyId,
    ),
    documentBytes: readCompanySeries(
      samples,
      SHELLUI_STORAGE_METRIC_NAMES.documentBytes,
      companyId,
    ),
    uploads24h: readCompanySeries(samples, SHELLUI_STORAGE_METRIC_NAMES.uploads24h, companyId),
    uploads7d: readCompanySeries(samples, SHELLUI_STORAGE_METRIC_NAMES.uploads7d, companyId),
    uploads30d: readCompanySeries(samples, SHELLUI_STORAGE_METRIC_NAMES.uploads30d, companyId),
    bytes7d: readCompanySeries(samples, SHELLUI_STORAGE_METRIC_NAMES.bytes7d, companyId),
    quotaUsedBytes: readCompanySeries(
      samples,
      SHELLUI_STORAGE_METRIC_NAMES.quotaUsedBytes,
      companyId,
    ),
    quotaMaxBytes: readCompanySeries(
      samples,
      SHELLUI_STORAGE_METRIC_NAMES.quotaMaxBytes,
      companyId,
    ),
  };
}
