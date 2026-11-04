import { requireAiServiceBaseUrl } from '@/lib/aiServiceUrl';

export type AiServiceHealthSnapshot = {
  status: string;
  service: string;
  version?: string;
};

export async function fetchAiServiceHealthLive(): Promise<AiServiceHealthSnapshot> {
  const baseUrl = requireAiServiceBaseUrl();
  const res = await fetch(`${baseUrl}/health/live`, {
    method: 'GET',
    credentials: 'omit',
  });
  if (!res.ok) {
    throw new Error(`ai-service health check failed (${res.status})`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const status = typeof body.status === 'string' ? body.status : 'unknown';
  const service = typeof body.service === 'string' ? body.service : 'ai-service';
  const version = typeof body.version === 'string' ? body.version : undefined;
  return { status, service, version };
}
