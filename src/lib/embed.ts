/**
 * The admin UI is meant to run inside the main ShellUI app’s iframe (`/admin`).
 * When opened as a top-level tab, `window.self === window.top`.
 */
export function isEmbeddedInShell(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * True when this frame is nested inside another same-origin admin frame (chrome ContentView).
 * Cross-origin parent (the shell) means we are the admin chrome, not content.
 */
export function isAdminContentFrame(): boolean {
  try {
    if (window.parent === window) return false;
    // Same origin: parent is also this admin app (chrome embedding content).
    void window.parent.location.origin;
    return window.parent.location.origin === window.location.origin;
  } catch {
    // Cross-origin parent (shell) — chrome mode.
    return false;
  }
}
