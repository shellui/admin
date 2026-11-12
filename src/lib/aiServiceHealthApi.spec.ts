import { describe, expect, it } from 'vitest';
import { parseAiServiceHealthLiveResponse } from '@/lib/aiServiceHealthApi';

describe('parseAiServiceHealthLiveResponse', () => {
  it('accepts plain-text ok from ai-service health_live', () => {
    expect(parseAiServiceHealthLiveResponse('ok')).toEqual({
      status: 'ok',
      service: 'ai-service',
    });
  });

  it('parses JSON bodies when present', () => {
    expect(
      parseAiServiceHealthLiveResponse(
        JSON.stringify({ status: 'ok', service: 'ai-service', version: '1.2.3' }),
      ),
    ).toEqual({
      status: 'ok',
      service: 'ai-service',
      version: '1.2.3',
    });
  });
});
