/** Identity admin list endpoints usually return `{ results: [...] }`; some may return a bare array. */
export function unwrapResultsArray(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return null;
  const results = (body as Record<string, unknown>).results;
  return Array.isArray(results) ? results : null;
}
