/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OAuth 2.0 Web client ID from Google Cloud Console; enables "Sign in with Google". */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Supabase project URL; with the anon key it switches on cloud accounts. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key. Browser-safe: row-level security limits what it can do. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
