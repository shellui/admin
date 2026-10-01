import shellui from '@shellui/sdk';

export const INVITE_ROUTE = '/invite';
export const INVITATIONS_ROUTE = '/invitations';

const INVITE_CHANNEL = 'shellui-admin-invitations';

/** Admin URL for a top-level route (rendered without the admin chrome), loaded by the shell in a modal iframe. */
export function adminModalUrl(
  route: string,
  location: Pick<Location, 'origin' | 'pathname'> = window.location,
) {
  return `${location.origin}${location.pathname}#${route}`;
}

export function inviteModalUrl(location: Pick<Location, 'origin' | 'pathname'> = window.location) {
  return adminModalUrl(INVITE_ROUTE, location);
}

export function openInviteUserModal(): void {
  shellui.openModal({ url: inviteModalUrl(), size: 'content', maxWidth: '32rem' });
}

export function openPendingInvitationsModal(): void {
  shellui.openModal({ url: adminModalUrl(INVITATIONS_ROUTE), size: 'content' });
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

/** Tell other admin frames (same origin) that an invitation was sent or revoked. */
export function notifyInvitationsChanged(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(INVITE_CHANNEL);
  channel.postMessage({ type: 'changed' });
  channel.close();
}

export function onInvitationsChanged(listener: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const channel = new BroadcastChannel(INVITE_CHANNEL);
  channel.onmessage = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === 'changed') listener();
  };
  return () => channel.close();
}
