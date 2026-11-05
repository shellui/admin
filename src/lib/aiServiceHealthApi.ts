export type AiServiceHealthSnapshot = {
  status: string;
  service: string;
  version?: string;
};

/** Parses ai-service `/health/live` (plain `ok` or JSON). For same-origin or proxied checks only. */
export function parseAiServiceHealthLiveResponse(raw: string): AiServiceHealthSnapshot {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { status: 'unknown', service: 'ai-service' };
  }
  if (trimmed === 'ok') {
    return { status: 'ok', service: 'ai-service' };
  }
  try {
    const body = JSON.parse(trimmed) as Record<string, unknown>;
    const status = typeof body.status === 'string' ? body.status : 'unknown';
    const service = typeof body.service === 'string' ? body.service : 'ai-service';
    const version = typeof body.version === 'string' ? body.version : undefined;
    return { status, service, version };
  } catch {
    return { status: trimmed, service: 'ai-service' };
  }
}
