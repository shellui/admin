import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchStorageMetricsSnapshot,
  formatBytes,
  parseStorageStatsSnapshot,
} from '@/lib/storageMetricsApi';

function accessToken(companyId: number): string {
  const payload = btoa(JSON.stringify({ company_id: companyId }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `header.${payload}.sig`;
}

describe('formatBytes', () => {
  it('formats bytes and kibibytes like storage-service', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KiB');
  });
});

describe('parseStorageStatsSnapshot', () => {
  it('maps JSON storage stats and selects the token company quota', () => {
    const snap = parseStorageStatsSnapshot(
      {
        object_count: 3,
        total_bytes: 4096,
        bucket_count: 2,
        document_count: 1,
        document_bytes: 1024,
        uploads_24h: 1,
        uploads_7d: 2,
        uploads_30d: 3,
        bytes_7d: 2048,
        quotas: [
          { company_id: 99, used_bytes: 999, max_bytes: 9999 },
          { company_id: 10, used_bytes: 4096, max_bytes: 1048576 },
        ],
      },
      10,
    );
    expect(snap).toEqual({
      objectsTotal: 3,
      bytesTotal: 4096,
      bucketsTotal: 2,
      documentsTotal: 1,
      documentBytes: 1024,
      uploads24h: 1,
      uploads7d: 2,
      uploads30d: 3,
      bytes7d: 2048,
      quotaUsedBytes: 4096,
      quotaMaxBytes: 1048576,
    });
  });

  it('defaults quota bytes to 0 when quotas is empty', () => {
    const snap = parseStorageStatsSnapshot({ object_count: 0, quotas: [] }, 10);
    expect(snap.quotaUsedBytes).toBe(0);
    expect(snap.quotaMaxBytes).toBe(0);
  });
});

describe('fetchStorageMetricsSnapshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls GET /storage/v1/stats', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toBe('https://storage.example.com/storage/v1/stats?days=1');
      return new Response(JSON.stringify({ object_count: 5, total_bytes: 100 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const snap = await fetchStorageMetricsSnapshot('https://storage.example.com/', accessToken(10));
    expect(snap.objectsTotal).toBe(5);
    expect(snap.bytesTotal).toBe(100);
  });
});
