import { describe, expect, it } from 'vitest';
import {
  getLoginCountsByProvider,
  getUnlabeled,
  parsePrometheusSamples,
  sumLoginCounts,
} from '@/lib/prometheusText';

describe('parsePrometheusSamples', () => {
  it('parses HELP/TYPE and sample lines', () => {
    const text = `
# HELP shellui_auth_users_total Number of Django user rows.
# TYPE shellui_auth_users_total gauge
shellui_auth_users_total 3.0
# TYPE shellui_auth_successful_logins_total counter
shellui_auth_successful_logins_total{provider="github"} 2.0
shellui_auth_successful_logins_total{provider="google"} 1.0
`.trim();
    const m = parsePrometheusSamples(text);
    expect(getUnlabeled(m, 'shellui_auth_users_total')).toBe(3);
    expect(getLoginCountsByProvider(m)).toEqual([
      { provider: 'github', count: 2 },
      { provider: 'google', count: 1 },
    ]);
    expect(sumLoginCounts(m)).toBe(3);
  });
});
