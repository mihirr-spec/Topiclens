/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OAuth 2.0 Web client ID from Google Cloud Console; enables "Sign in with Google". */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
