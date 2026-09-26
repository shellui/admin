import { describe, expect, it } from 'vitest';
import { parseScimTokenCreate, parseScimTokensList } from '@/lib/scimApiParsers';

describe('scimApiParsers', () => {
  it('parses identity GET /scim/tokens envelope', () => {
    const rows = parseScimTokensList({
      results: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Okta prod',
          token_prefix: 'tok_xxxx',
          created_at: '2026-01-01T00:00:00Z',
          revoked_at: null,
          last_used_at: null,
          is_active: true,
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(rows[0].label).toBe('Okta prod');
    expect(rows[0].is_active).toBe(true);
  });

  it('accepts bare array for tokens list', () => {
    const rows = parseScimTokensList([{ id: 'x', name: '', token_prefix: 'p', is_active: false }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].is_active).toBe(false);
  });

  it('parses create response with secret once', () => {
    const created = parseScimTokenCreate({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'IdP',
      token_prefix: 'tok_yyyy',
      token: 'test_token_value',
      is_active: true,
    });
    expect(created.token).toBe('test_token_value');
    expect(created.label).toBe('IdP');
  });
});
