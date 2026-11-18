import shellui from '@shellui/sdk';
import { adminModalUrl } from '@/lib/inviteModal';

/** Hash route loaded inside the shell drawer (no admin chrome). */
export const AGENT_CONNECT_ROUTE = '/agents/connect';

const AGENTS_CHANNEL = 'shellui-admin-agents';

/** Admin URL for the connect route, opened by the shell in a drawer iframe. */
export function agentConnectDrawerUrl(
  location: Pick<Location, 'origin' | 'pathname'> = window.location,
) {
  return adminModalUrl(AGENT_CONNECT_ROUTE, location);
}

/**
 * Open the shell drawer (SHELLUI_OPEN_DRAWER), the same overlay Files and Playground use.
 * The admin chrome relays the message from a nested content frame up to the shell.
 */
export function openAgentConnectDrawer(): void {
  shellui.openDrawer({
    url: agentConnectDrawerUrl(),
    position: 'right',
    size: 'md',
  });
}

/** Tell other admin frames (same origin) that an agent connection was created. */
export function notifyAgentsChanged(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(AGENTS_CHANNEL);
  channel.postMessage({ type: 'changed' });
  channel.close();
}

export function onAgentsChanged(listener: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const channel = new BroadcastChannel(AGENTS_CHANNEL);
  channel.onmessage = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === 'changed') listener();
  };
  return () => channel.close();
}
