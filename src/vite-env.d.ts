/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the iptv-org JSON base URL (e.g. a self-hosted mirror). */
  readonly VITE_IPTV_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
