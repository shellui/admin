import { addMessageListener } from '@shellui/sdk';
import type { ShellUIMessage } from '@shellui/sdk';
import { isParentShellSettingsMessage } from '@/lib/parentOrigin';

export const SETTINGS_MESSAGE_TYPES = ['SHELLUI_SETTINGS', 'SHELLUI_SETTINGS_UPDATED'] as const;

export type ParentSettingsHandler = (message: ShellUIMessage, event: MessageEvent) => void;

/**
 * The only way admin subscribes to `SHELLUI_SETTINGS` and `SHELLUI_SETTINGS_UPDATED`.
 * The handler runs only for messages sent by `window.parent` at the parent origin, so a
 * nested app cannot change URLs, tokens, theme or the origin allowlist. Returns one
 * cleanup function for both subscriptions.
 */
export function addParentSettingsListener(handler: ParentSettingsHandler): () => void {
  const guarded: ParentSettingsHandler = (message, event) => {
    if (!isParentShellSettingsMessage(event)) return;
    handler(message, event);
  };
  const offs = SETTINGS_MESSAGE_TYPES.map((type) => addMessageListener(type, guarded));
  return () => {
    for (const off of offs) off();
  };
}
