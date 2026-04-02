/**
 * Minimal parser for Prometheus text exposition (single number per line).
 * Sufficient for staff metrics that use gauges without labels and counters with `provider` label only.
 */

export function parsePrometheusSamples(text: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.lastIndexOf(' ');
    if (idx <= 0) continue;
    const lhs = t.slice(0, idx).trim();
    const v = Number(t.slice(idx + 1).trim());
    if (!Number.isFinite(v)) continue;
    m.set(lhs, v);
  }
  return m;
}

export function getUnlabeled(samples: Map<string, number>, name: string): number | undefined {
  return samples.get(name);
}

const LOGIN_SERIES = /^shellui_auth_successful_logins_total\{provider="([^"]+)"\}$/;

export type LoginCountRow = { provider: string; count: number };

export function getLoginCountsByProvider(samples: Map<string, number>): LoginCountRow[] {
  const out: LoginCountRow[] = [];
  for (const [k, v] of samples) {
    const m = k.match(LOGIN_SERIES);
    if (m) out.push({ provider: m[1], count: v });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

export function sumLoginCounts(samples: Map<string, number>): number {
  return getLoginCountsByProvider(samples).reduce((s, x) => s + x.count, 0);
}
