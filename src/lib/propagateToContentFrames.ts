import shellui, { type ShellUIMessage } from '@shellui/sdk';
import { isAdminContentFrame } from '@/lib/embed';

const SETTINGS_MESSAGE_TYPES = ['SHELLUI_SETTINGS', 'SHELLUI_SETTINGS_UPDATED'] as const;

/**
 * Admin chrome hosts nested apps via core ContentView (SDK `addIframe`).
 * Live settings from the parent shell arrive with an empty remaining `to` path, so the SDK
 * does not fan them out. Re-broadcast so nested frames get theme / language / token updates
 * without a full remount (refresh already works via SETTINGS_REQUESTED routing).
 *
 * Content leaf frames skip this — they do not host ContentView.
 */
export function setupContentFrameMessagePropagation(): void {
  if (typeof window === 'undefined' || window.parent === window) return;
  if (isAdminContentFrame()) return;

  const forward = (message: ShellUIMessage) => {
    shellui.propagateMessage({
      type: message.type,
      payload: message.payload,
    });
  };

  for (const type of SETTINGS_MESSAGE_TYPES) {
    shellui.addMessageListener(type, forward);
  }
}
