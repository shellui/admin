/// <reference types="vite/client" />

declare module '*.svg?raw' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_IDENTITY_URL?: string;
  readonly VITE_STORAGE_URL?: string;
  readonly VITE_HOSTING_URL?: string;
  readonly VITE_EMAIL_URL?: string;
  readonly VITE_FILES_URL?: string;
  readonly VITE_AI_SERVICE_URL?: string;
  readonly VITE_COMPANY_AGENTS_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
