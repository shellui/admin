import { describe, expect, it } from 'vitest';
import { readSettingsAiService, resolveAiServiceUrl } from '@/lib/aiServiceUrl';
import type { Settings } from '@shellui/sdk';

describe('resolveAiServiceUrl', () => {
  it('has no default origin', () => {
    expect(resolveAiServiceUrl(undefined)).toBeNull();
    expect(resolveAiServiceUrl('  ')).toBeNull();
    expect(resolveAiServiceUrl('http://localhost:8004/')).toBe('http://localhost:8004');
  });
});

describe('readSettingsAiService', () => {
  it('reads aiService.url from host settings the same way as storage and hosting', () => {
    const settings = {
      aiService: { url: 'https://ai.example.com/' },
    } as unknown as Settings;
    expect(readSettingsAiService(settings)).toEqual({
      url: 'https://ai.example.com',
    });
  });

  it('returns null when the shell sends no ai-service url', () => {
    expect(readSettingsAiService(undefined)).toBeNull();
    expect(readSettingsAiService({ aiService: null } as unknown as Settings)).toBeNull();
    expect(readSettingsAiService({ aiService: {} } as unknown as Settings)).toBeNull();
  });
});
