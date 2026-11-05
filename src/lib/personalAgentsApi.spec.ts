import { describe, expect, it } from 'vitest';
import type { CreatePersonalAgentInput } from '@/lib/personalAgentsApi';

describe('personalAgentsApi types', () => {
  it('accepts create payload shape', () => {
    const input: CreatePersonalAgentInput = {
      name: 'Test',
      services: ['identity', 'storage'],
      access_mode: 'ask',
      read_level: 'safe',
      allow_destructive: false,
      expires_at: '2027-01-01T00:00:00.000Z',
    };
    expect(input.services).toHaveLength(2);
  });
});
