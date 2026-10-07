import type { ScimConfig, ScimTokenRow } from '@/lib/scimApi';

export type ScimTokenBuckets = {
  active: ScimTokenRow[];
  revoked: ScimTokenRow[];
};

export function partitionScimTokens(rows: ScimTokenRow[]): ScimTokenBuckets {
  const active: ScimTokenRow[] = [];
  const revoked: ScimTokenRow[] = [];
  for (const row of rows) {
    if (row.is_active) {
      active.push(row);
    } else {
      revoked.push(row);
    }
  }
  return { active, revoked };
}

export function isScimDeploymentAvailable(config: ScimConfig | null): boolean {
  return config != null && config.enabled;
}

export type ScimSetupPhase = 'loading' | 'deployment_off' | 'no_token' | 'active' | 'revoked_only';

export function scimSetupPhase(input: {
  loading: boolean;
  deploymentAvailable: boolean;
  activeCount: number;
  revokedCount: number;
}): ScimSetupPhase {
  if (input.loading) return 'loading';
  if (!input.deploymentAvailable) return 'deployment_off';
  if (input.activeCount > 0) return 'active';
  if (input.revokedCount > 0) return 'revoked_only';
  return 'no_token';
}
