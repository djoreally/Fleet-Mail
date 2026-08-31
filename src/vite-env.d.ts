/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEON_DATA_API_URL?: string;
  readonly VITE_NEON_AUTH_URL?: string;
  readonly VITE_ATLASCLOUD_API_KEY?: string;
  readonly VITE_AGENTMAIL_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
