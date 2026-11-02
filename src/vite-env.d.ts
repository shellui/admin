/// <reference types="vite/client" />

declare module '*.svg?raw' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_STORAGE_URL?: string;
  readonly VITE_AI_SERVICE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
