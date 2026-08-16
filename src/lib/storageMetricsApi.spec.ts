import { describe, expect, it } from 'vitest';
import { parsePrometheusSamples } from '@/lib/prometheusText';
import { formatBytes, SHELLUI_STORAGE_METRIC_NAMES } from '@/lib/storageMetricsApi';

describe('formatBytes', () => {
  it('formats bytes and kibibytes like storage-service', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KiB');
  });
});

describe('storage prometheus samples', () => {
  it('reads company-labeled storage gauges', () => {
    const text = `
# TYPE shellui_storage_objects_total gauge
shellui_storage_objects_total{company_id="10"} 3.0
# TYPE shellui_storage_bytes_total gauge
shellui_storage_bytes_total{company_id="10"} 4096.0
`.trim();
    const samples = parsePrometheusSamples(text);
    expect(samples.get(`${SHELLUI_STORAGE_METRIC_NAMES.objectsTotal}{company_id="10"}`)).toBe(3);
    expect(samples.get(`${SHELLUI_STORAGE_METRIC_NAMES.bytesTotal}{company_id="10"}`)).toBe(4096);
  });
});
