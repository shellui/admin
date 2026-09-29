import { describe, expect, it } from 'vitest';
import {
  isScimDeploymentAvailable,
  partitionScimTokens,
  scimSetupPhase,
} from '@/lib/scimSetupView';
import type { ScimTokenRow } from '@/lib/scimApi';

function token(partial: Partial<ScimTokenRow> & Pick<ScimTokenRow, 'id'>): ScimTokenRow {
  return {
    label: '',
    token_prefix: 'tok_abc',
    created_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    last_used_at: null,
    is_active: true,
    ...partial,
  };
}

describe('scimSetupView', () => {
  it('partitions active and revoked tokens', () => {
    const buckets = partitionScimTokens([
      token({ id: '1', is_active: true }),
      token({ id: '2', is_active: false, revoked_at: '2026-02-01T00:00:00Z' }),
    ]);
    expect(buckets.active.map((r) => r.id)).toEqual(['1']);
    expect(buckets.revoked.map((r) => r.id)).toEqual(['2']);
  });

  it('treats deployment as available only when config.enabled is true', () => {
    expect(isScimDeploymentAvailable(null)).toBe(false);
    expect(
      isScimDeploymentAvailable({
        base_url: 'https://example/scim',
        enabled: false,
        configured: true,
      }),
    ).toBe(false);
    expect(
      isScimDeploymentAvailable({
        base_url: 'https://example/scim',
        enabled: true,
        configured: false,
      }),
    ).toBe(true);
  });

  it('derives setup phase from token counts', () => {
    expect(
      scimSetupPhase({
        loading: true,
        deploymentAvailable: true,
        activeCount: 0,
        revokedCount: 0,
      }),
    ).toBe('loading');
    expect(
      scimSetupPhase({
        loading: false,
        deploymentAvailable: false,
        activeCount: 1,
        revokedCount: 0,
      }),
    ).toBe('deployment_off');
    expect(
      scimSetupPhase({
        loading: false,
        deploymentAvailable: true,
        activeCount: 2,
        revokedCount: 1,
      }),
    ).toBe('active');
    expect(
      scimSetupPhase({
        loading: false,
        deploymentAvailable: true,
        activeCount: 0,
        revokedCount: 1,
      }),
    ).toBe('revoked_only');
    expect(
      scimSetupPhase({
        loading: false,
        deploymentAvailable: true,
        activeCount: 0,
        revokedCount: 0,
      }),
    ).toBe('no_token');
  });
});
