import { bearerFetch } from './shellAccessToken';
import { getCompanyIdFromJwt } from '@/lib/jwtCompany';

export type StorageMetricsSnapshot = {
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

type StorageStatsJson = {
  object_count?: number;
  total_bytes?: number;
  bucket_count?: number;
  document_count?: number;
  document_bytes?: number;
  uploads_24h?: number;
  uploads_7d?: number;
  uploads_30d?: number;
  bytes_7d?: number;
  quotas?: Array<{
    company_id?: number;
    used_bytes?: number;
    max_bytes?: number;
  }>;
};

function parseErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === 'string') return o.detail;
  if (typeof o.error === 'string') return o.error;
  if (typeof o.message === 'string') return o.message;
  return null;
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

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function parseStorageStatsSnapshot(
  body: unknown,
  companyId: number,
): StorageMetricsSnapshot {
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected storage stats response.');
  }
  const data = body as StorageStatsJson;
  const quotas = Array.isArray(data.quotas) ? data.quotas : [];
  const companyQuota = quotas.find((row) => row.company_id === companyId) ?? quotas[0];
  return {
    objectsTotal: num(data.object_count),
    bytesTotal: num(data.total_bytes),
    bucketsTotal: num(data.bucket_count),
    documentsTotal: num(data.document_count),
    documentBytes: num(data.document_bytes),
    uploads24h: num(data.uploads_24h),
    uploads7d: num(data.uploads_7d),
    uploads30d: num(data.uploads_30d),
    bytes7d: num(data.bytes_7d),
    quotaUsedBytes: num(companyQuota?.used_bytes),
    quotaMaxBytes: num(companyQuota?.max_bytes),
  };
}

/** Storage JSON stats from storage-service `GET /storage/v1/stats`. */
export async function fetchStorageMetricsSnapshot(
  storageBaseUrl: string,
  accessToken: string,
): Promise<StorageMetricsSnapshot> {
  const companyId = getCompanyIdFromJwt(accessToken);
  if (!companyId) {
    throw new Error('Missing company_id in access token.');
  }
  const res = await bearerFetch(
    `${storageBaseUrl.replace(/\/+$/, '')}/storage/v1/stats?days=1`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
    accessToken,
  );
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseErrorMessage(body) || `Request failed (${res.status})`);
  }
  return parseStorageStatsSnapshot(body, companyId);
}
