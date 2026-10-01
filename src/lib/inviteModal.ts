import shellui from '@shellui/sdk';

export const INVITE_ROUTE = '/invite';

const INVITE_CHANNEL = 'shellui-admin-invitations';

/** Admin URL for the invite form, loaded by the shell in a modal iframe. */
export function inviteModalUrl(location: Pick<Location, 'origin' | 'pathname'> = window.location) {
  return `${location.origin}${location.pathname}#${INVITE_ROUTE}`;
}

export function openInviteUserModal(): void {
  shellui.openModal({ url: inviteModalUrl(), size: 'content', maxWidth: '32rem' });
}

/**
 * Origin of the top-level shell window (the app users sign in to), with a trailing slash.
 * Admin frames are nested in the shell, so the outermost ancestor is the shell.
 */
export function resolveShellAppUrl(
  location: Location & { ancestorOrigins?: DOMStringList } = window.location,
  referrer: string = document.referrer,
): string | null {
  const ancestors = location.ancestorOrigins;
  if (ancestors && ancestors.length > 0) {
    const top = ancestors[ancestors.length - 1];
    if (top && top !== 'null') return `${top}/`;
  }
  if (referrer) {
    try {
      return `${new URL(referrer).origin}/`;
    } catch {
      return null;
    }
  }
  return null;
}

/** Tell other admin frames (same origin) that an invitation was sent. */
export function notifyUserInvited(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(INVITE_CHANNEL);
  channel.postMessage({ type: 'invited' });
  channel.close();
}

export function onUserInvited(listener: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const channel = new BroadcastChannel(INVITE_CHANNEL);
  channel.onmessage = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === 'invited') listener();
  };
  return () => channel.close();
}
