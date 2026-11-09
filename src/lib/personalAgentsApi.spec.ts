import { describe, expect, it } from 'vitest';
import {
  parseMcpPersonalAgent,
  parseMcpPersonalAgentsResponse,
  type CreatePersonalAgentInput,
} from '@/lib/personalAgentsApi';

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

  it('parses oauth and static rows and skips a row with no kind', () => {
    const agents = parseMcpPersonalAgentsResponse({
      agents: [
        {
          id: 'oauth-1',
          kind: 'oauth',
          name: 'Cursor laptop',
          access_mode: 'ask',
          read_level: 'safe',
          allow_destructive_without_asking: false,
          services_allowed: ['identity', 'storage'],
          expires_at: '2026-12-01T00:00:00Z',
          paused_at: null,
          revoked_at: null,
          is_active: true,
          created_at: '2026-06-01T00:00:00Z',
          oauth_client_id: 'client-1',
          personal_token_id: null,
        },
        {
          id: 'static-1',
          kind: 'personal',
          name: 'Static laptop',
          access_mode: 'ask',
          read_level: 'safe',
          services_allowed: ['identity'],
          is_active: true,
          created_at: '2026-05-01T00:00:00Z',
          personal_token_id: 'pt-1',
        },
        { id: 'bad', name: 'Missing kind', created_at: '2026-01-01T00:00:00Z' },
      ],
    });
    expect(agents.map((agent) => agent.kind)).toEqual(['oauth', 'personal']);
    expect(agents[0]?.services_allowed).toEqual(['identity', 'storage']);
    expect(parseMcpPersonalAgent({ id: 'x' })).toBeNull();
  });
});
