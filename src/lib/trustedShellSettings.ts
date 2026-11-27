import type { Settings } from '@shellui/sdk';

/**
 * Trusted shell settings for this frame.
 *
 * SDK 0.8.1 could write `shellui.initialSettings` from an allowlisted child frame.
 * After `shellui.init()`, admin copies the settings into this snapshot and never
 * reads the live object again. Only `addParentSettingsListener` may update it.
 */
let snapshot: Settings | null = null;
let captured = false;

function copy(settings: Settings | null | undefined): Settings | null {
  return settings ? { ...settings } : null;
}

/** Call once after `await shellui.init()`, before React mounts or hydrates caches. */
export function snapshotTrustedShellSettings(settings: Settings | null | undefined | object): void {
  snapshot = copy((settings ?? null) as Settings | null);
  captured = true;
}

/** Parent settings payload. Missing fields keep their previous trusted values. */
export function applyTrustedShellSettings(settings: Settings): void {
  snapshot = { ...(snapshot ?? {}), ...settings };
  captured = true;
}

export function getTrustedShellSettings(): Settings | null {
  return captured ? snapshot : null;
}

/** Test-only. */
export function resetTrustedShellSettings(): void {
  snapshot = null;
  captured = false;
}
