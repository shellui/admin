import { useShelluiStorage } from '@/hooks/useShelluiStorage';

/** storage-service base URL from host `storage.url` (via SDK). */
export function useStorageBaseUrl(): string | null {
  const storage = useShelluiStorage();
  const url = storage?.url?.trim().replace(/\/+$/, '') || null;
  return url;
}

export async function fetchStorageStats(
  storageBaseUrl: string,
  accessToken: string,
  days = 14,
): Promise<StorageStatsSnapshot> {
  const response = await fetch(
    `${storageBaseUrl.replace(/\/+$/, '')}/storage/v1/stats?days=${days}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) {
    let message = response.statusText || 'Request failed';
    try {
      const body = (await response.json()) as { message?: string };
      message = body.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await response.json()) as StorageStatsSnapshot;
}

export type StorageStatsSnapshot = {
  scope_company_id: number | null;
  object_count: number;
  total_bytes: number;
  total_bytes_display: string;
  bucket_count: number;
  company_count: number;
  document_count: number;
  document_bytes: number;
  document_bytes_display: string;
  uploads_24h: number;
  uploads_7d: number;
  uploads_30d: number;
  bytes_7d: number;
  bytes_7d_display: string;
  by_family: { family: string; object_count: number; total_bytes_display: string }[];
  by_bucket: { label: string; object_count: number; total_bytes_display: string }[];
  by_mime: { mime_type: string; object_count: number; total_bytes_display: string }[];
  quotas: {
    company_id: number;
    used_display: string;
    max_display: string;
    pct: number;
  }[];
  daily_series: {
    day: string;
    object_count: number;
    total_bytes_display: string;
    bar_pct: number;
  }[];
  recent: {
    basename: string;
    name: string;
    bucket: string;
    company_id: number;
    mime_type: string;
    size_display: string;
    created_at: string | null;
    is_document: boolean;
  }[];
  generated_at: string | null;
};
