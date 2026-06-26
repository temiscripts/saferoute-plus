/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CHECKIN_AUTO_INTERVAL_SECONDS?: string;
  readonly VITE_CHECKIN_DEADMAN_THRESHOLD_SECONDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
