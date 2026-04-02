/** Same origin as ShellUI `backend.url` in shellui.config.ts (django shellui-auth). */
export function getAuthBackendBaseUrl(): string {
  const raw = import.meta.env.VITE_SHELLUI_BACKEND_URL;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}
