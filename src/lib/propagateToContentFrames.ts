import shellui, { type ShellUIMessage } from '@shellui/sdk';
import {
  frameSettingsDelivery,
  getContentFrameAuthRules,
  settingsPayloadForDelivery,
} from '@/lib/contentFrameAuth';
import { isAdminContentFrame } from '@/lib/embed';

/** Admin's own `storage` settings, handed to the Files app it embeds. */
let ownStorage: unknown = shellui.initialSettings?.storage ?? null;

function originOf(url: unknown): string | null {
  try {
    return typeof url === 'string' && url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

/**
 * The Files app needs `storage.url`, which only admin knows when embedded in a dashboard.
 * Add it for the frame whose exact origin is admin's `storage.filesUrl`, never any other.
 */
function withFilesStorage(payload: ShellUIMessage['payload'], frameSrc: string) {
  const filesOrigin = originOf((ownStorage as { filesUrl?: unknown } | null)?.filesUrl);
  if (!filesOrigin || originOf(frameSrc) !== filesOrigin) return payload;
  const settings = (payload as { settings?: Record<string, unknown> } | undefined)?.settings;
  if (!settings) return payload;
  return { ...(payload as object), settings: { ...settings, storage: ownStorage } };
}

const SETTINGS_MESSAGE_TYPES = ['SHELLUI_SETTINGS', 'SHELLUI_SETTINGS_UPDATED'] as const;

/**
 * The SDK relays a parent message to `message.to` after listeners run, using the
 * original payload. That list is shared with the event, so clearing it stops a
 * shell reply (addressed to a nested frame) from carrying `accessToken` through.
 */
function stopParentSettingsRelay(message: ShellUIMessage): void {
  if (message.to && message.to.length > 0) {
    message.to.length = 0;
  }
}

/**
 * Re-broadcast shell settings to live ContentView iframes.
 * `accessToken` is kept only for same-origin admin frames and URLs marked
 * `safeForAuthToken`. Other frames receive settings with the token removed.
 * `ignoreMessages` frames that are not opted in are skipped, except a reply
 * addressed to that frame (appearance on the handshake, still without the token).
 */
export function forwardSettingsToContentFrames(message: ShellUIMessage): void {
  const addressed = new Set(message.to ?? []);
  stopParentSettingsRelay(message);
  if (!addressed.size) {
    const storage = (message.payload as { settings?: { storage?: unknown } } | undefined)?.settings
      ?.storage;
    if (storage) ownStorage = storage;
  }
  const registry = shellui.frameRegistry;
  if (!registry || typeof registry.getLiveIframes !== 'function') return;

  const pageHref = window.location.href;
  const rules = getContentFrameAuthRules();
  for (const [uuid, iframe] of registry.getLiveIframes()) {
    const frameSrc = iframe?.src?.trim() ?? '';
    if (!frameSrc) continue;
    const delivery = frameSettingsDelivery(frameSrc, rules, pageHref);
    // ignoreMessages frames are omitted from the fan-out. Answer a reply that
    // names this frame so its handshake can apply appearance, still without the token.
    const handshake = !delivery.forward && addressed.has(uuid);
    if (!delivery.forward && !handshake) continue;
    shellui.sendMessage({
      type: message.type,
      payload: withFilesStorage(
        settingsPayloadForDelivery(message.payload, delivery.includeAccessToken),
        frameSrc,
      ),
      to: [uuid],
    });
  }
}

/**
 * Admin chrome hosts nested apps via core ContentView (SDK `addIframe`).
 * Live settings from the parent shell arrive with an empty remaining `to` path, so the SDK
 * does not fan them out. Re-broadcast so nested frames get theme and language updates
 * without a full remount (a nested `SETTINGS_REQUESTED` is answered the same way).
 *
 * Content leaf frames skip this. They do not host ContentView.
 */
export function setupContentFrameMessagePropagation(): void {
  if (typeof window === 'undefined' || window.parent === window) return;
  if (isAdminContentFrame()) return;

  const forward = (message: ShellUIMessage) => {
    forwardSettingsToContentFrames(message);
  };

  for (const type of SETTINGS_MESSAGE_TYPES) {
    shellui.addMessageListener(type, forward);
  }
}
