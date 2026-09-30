/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_TENANT_SLUG?: string;
  readonly VITE_TENANT_BASE_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected at build time from package.json's version (see vite.config.ts). */
declare const __APP_VERSION__: string;
