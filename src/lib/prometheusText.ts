/**
 * Minimal parser for Prometheus text exposition (single number per line).
 * Sufficient for staff metrics that use gauges without labels and labeled series keyed by full LHS.
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
