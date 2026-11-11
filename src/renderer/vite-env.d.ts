/// <reference types="vite/client" />
/// <reference types="electron" />

interface ImportMetaEnv {
  readonly VITE_ELECTRON: string;
  readonly VITE_DEV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
