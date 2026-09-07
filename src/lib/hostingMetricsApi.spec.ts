import { describe, expect, it } from 'vitest';
import { parsePrometheusSamples } from '@/lib/prometheusText';
import { SHELLUI_HOSTING_METRIC_NAMES } from '@/lib/hostingMetricsApi';

describe('hosting prometheus samples', () => {
  it('reads company-labeled hosting gauges', () => {
    const text = `
# TYPE shellui_hosting_apps_total gauge
shellui_hosting_apps_total{company_id="10"} 2.0
# TYPE shellui_hosting_artifact_bytes gauge
shellui_hosting_artifact_bytes{company_id="10"} 8192.0
`.trim();
    const samples = parsePrometheusSamples(text);
    expect(samples.get(`${SHELLUI_HOSTING_METRIC_NAMES.appsTotal}{company_id="10"}`)).toBe(2);
    expect(samples.get(`${SHELLUI_HOSTING_METRIC_NAMES.artifactBytes}{company_id="10"}`)).toBe(
      8192,
    );
  });
});
