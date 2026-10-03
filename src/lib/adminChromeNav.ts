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

/** Standalone Email group titles. Per-service "Email and webhooks" links are separate. */
export function isStandaloneEmailGroupTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return normalized === 'email' || normalized === 'e-mail';
}

/** The Email group is the last sidebar section. Other sections keep their order. */
export function placeStandaloneEmailSectionLast<T extends { title: string }>(sections: T[]): T[] {
  const rest: T[] = [];
  const email: T[] = [];
  for (const section of sections) {
    if (isStandaloneEmailGroupTitle(section.title)) email.push(section);
    else rest.push(section);
  }
  return [...rest, ...email];
}

/** Hash-router path without query, e.g. `/users` from `#/users?x=1`. */
export function getAdminHashPath(): string {
  if (typeof window === 'undefined') return '/';
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const path = raw.split('?')[0] || '/';
  return path.replace(/\/+$/, '') || '/';
}
