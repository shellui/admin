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
