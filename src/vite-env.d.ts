/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Django shellui-auth base URL (no trailing slash), e.g. http://localhost:8000 */
  readonly VITE_SHELLUI_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
