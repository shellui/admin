import { resolveParentTargetOrigin } from '@shellui/sdk';

/**
 * Parent origin for shell messages. Null when this frame cannot name it, which
 * callers must treat as "trust nothing". Browsers without `ancestorOrigins`
 * (Firefox) get the origin from the referrer; with no referrer it stays null.
 */
export function expectedParentOrigin(): string | null {
  const origin = resolveParentTargetOrigin();
  if (typeof origin !== 'string') return null;
  if (origin.length === 0 || origin === '*' || origin === 'null') return null;
  return origin;
}

/**
 * True when a settings message comes from `window.parent` and `event.origin`
 * is that parent origin. Messages from any child frame fail this check.
 */
export function isParentShellSettingsMessage(event: MessageEvent | undefined): boolean {
  if (!event || typeof window === 'undefined') return false;
  if (event.source !== window.parent) return false;
  const expected = expectedParentOrigin();
  return expected !== null && event.origin === expected;
}
