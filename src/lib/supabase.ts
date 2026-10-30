import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client, built from the browser-safe URL and anon key in .env.local.
 * Without them the app runs in local mode (accounts in localStorage), so the
 * project still works for anyone who clones it without a Supabase project.
 */
const url = (import.meta.env?.VITE_SUPABASE_URL ?? "").trim();
const anonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY ?? "").trim();

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

export const cloudEnabled = supabase !== null;
