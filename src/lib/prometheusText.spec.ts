import { describe, expect, it } from 'vitest';
import { getUnlabeled, parsePrometheusSamples } from '@/lib/prometheusText';

describe('parsePrometheusSamples', () => {
  it('parses HELP/TYPE and sample lines', () => {
    const text = `
# HELP shellui_auth_users_total Number of Django user rows.
# TYPE shellui_auth_users_total gauge
shellui_auth_users_total 3.0
# TYPE shellui_auth_company_users_total gauge
shellui_auth_company_users_total{company_id="1"} 42.0
`.trim();
    const m = parsePrometheusSamples(text);
    expect(getUnlabeled(m, 'shellui_auth_users_total')).toBe(3);
    expect(m.get('shellui_auth_company_users_total{company_id="1"}')).toBe(42);
  });
});
