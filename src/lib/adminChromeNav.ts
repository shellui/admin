const SIDEBAR_COLLAPSED_KEY = 'shellui-admin:sidebar:collapsed';

export function readSidebarCollapsed(defaultCollapsed = false): boolean {
  try {
    const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (raw === null) return defaultCollapsed;
    return raw === '1';
  } catch {
    return defaultCollapsed;
  }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}

/** Hash-router path without query, e.g. `/users` from `#/users?x=1`. */
export function getAdminHashPath(): string {
  if (typeof window === 'undefined') return '/';
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const path = raw.split('?')[0] || '/';
  return path.replace(/\/+$/, '') || '/';
}
