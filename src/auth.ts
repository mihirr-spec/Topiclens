import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { PERSONAS, seedHistory } from "./data/mind";
import { loadProfile, saveProfile } from "./lib/cloud";
import { cloudEnabled, supabase } from "./lib/supabase";

/**
 * Accounts and sign-in.
 *
 * Cloud mode (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set): real accounts in
 * Supabase Auth (email + password, Google, anonymous guest); profiles, preferences
 * and every interaction are stored in Postgres and follow the user across devices.
 *
 * Local mode (no Supabase keys): an account is a profile in this browser's
 * localStorage, as before. Demo readers are always local: they are shared sample
 * profiles of real anonymised MIND users, not anyone's account.
 */

export type Provider = "google" | "email" | "guest" | "demo";

export interface Account {
  id: string;
  provider: Provider;
  name: string;
  email?: string;
  picture?: string;
  /** Categories picked at onboarding. Empty until onboarding is finished. */
  interests: string[];
  /** History the feed starts from (reset-user returns to it). */
  seedHistoryIds: string[];
  createdAt: string;
  /** Stored in Supabase rather than this browser. */
  cloud?: boolean;
}

export const GOOGLE_CLIENT_ID = (import.meta.env?.VITE_GOOGLE_CLIENT_ID ?? "").trim();
export { cloudEnabled };

const ACCOUNTS_KEY = "topiclens:accounts:v1";
const SESSION_KEY = "topiclens:session:v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the session lasts until the tab closes */
  }
}

export function demoAccount(personaId: string): Account {
  const p = PERSONAS.find((u) => u.id === personaId)!;
  return {
    id: p.id, provider: "demo", name: p.name, interests: p.interests,
    seedHistoryIds: p.historyIds, createdAt: new Date().toISOString(),
  };
}

export function emailAccount(name: string, email: string): Account {
  const e = email.trim().toLowerCase();
  return { id: `email:${e}`, provider: "email", name: name.trim() || e.split("@")[0], email: e, interests: [], seedHistoryIds: [], createdAt: new Date().toISOString() };
}

export function guestAccount(): Account {
  const id = `guest:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { id, provider: "guest", name: "Guest", interests: [], seedHistoryIds: [], createdAt: new Date().toISOString() };
}

/** Local mode only: reads the profile claims from a Google ID token (JWT), unverified. Cloud mode verifies through Supabase. */
export function googleAccount(credential: string): Account {
  const payload = credential.split(".")[1] ?? "";
  const json = decodeURIComponent(
    atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  );
  const claims = JSON.parse(json) as { sub: string; name?: string; given_name?: string; email?: string; picture?: string };
  return {
    id: `google:${claims.sub}`, provider: "google", name: claims.given_name ?? claims.name ?? claims.email ?? "Google user",
    email: claims.email, picture: claims.picture, interests: [], seedHistoryIds: [], createdAt: new Date().toISOString(),
  };
}

export function withInterests(account: Account, interests: string[]): Account {
  return { ...account, interests, seedHistoryIds: seedHistory(interests) };
}

/** Turns a Supabase user + their profile row into an Account. */
async function cloudAccount(user: User): Promise<Account> {
  const profile = await loadProfile(user.id);
  const meta = user.user_metadata ?? {};
  const provider: Provider = user.is_anonymous ? "guest" : user.app_metadata?.provider === "google" ? "google" : "email";
  return {
    id: user.id,
    provider,
    name: profile?.name || meta.name || meta.full_name || user.email?.split("@")[0] || "Guest",
    email: user.email ?? undefined,
    picture: meta.avatar_url ?? meta.picture ?? undefined,
    interests: profile?.sections ?? [],
    seedHistoryIds: profile?.seed_history ?? [],
    createdAt: user.created_at,
    cloud: true,
  };
}

/** Plain-language versions of the auth errors people actually hit. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match an account.";
  if (/email not confirmed/i.test(message)) return "Check your inbox and confirm your email first.";
  if (/already registered|already been registered/i.test(message)) return "There's already an account with that email. Sign in instead.";
  if (/anonymous sign-ins are disabled/i.test(message)) return "Guest sign-in is turned off for this project.";
  if (/provider is not enabled|unsupported provider/i.test(message)) return "Google sign-in isn't switched on for this project yet.";
  if (/password should be at least/i.test(message)) return "Use a password of at least 6 characters.";
  return message;
}

export type AuthResult = { error?: string; notice?: string };

export function useAuth() {
  // Local accounts (local mode) and the demo-reader session (both modes).
  const [accounts, setAccounts] = useState<Record<string, Account>>(() => read(ACCOUNTS_KEY, {}));
  const [sessionId, setSessionId] = useState<string | null>(() => read<string | null>(SESSION_KEY, null));
  const [cloudUser, setCloudUser] = useState<Account | null>(null);
  const [ready, setReady] = useState(!cloudEnabled);

  useEffect(() => write(ACCOUNTS_KEY, accounts), [accounts]);
  useEffect(() => write(SESSION_KEY, sessionId), [sessionId]);

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    const apply = async (user: User | null) => {
      try {
        const account = user ? await cloudAccount(user) : null;
        if (live) setCloudUser(account);
      } catch (e) {
        console.warn("TopicLens: could not load profile", e);
        if (live) setCloudUser(null);
      } finally {
        if (live) setReady(true);
      }
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer: Supabase recommends not awaiting other Supabase calls inside this callback.
      setTimeout(() => void apply(session?.user ?? null), 0);
    });
    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /** Local sign-in: demo readers (always) and local-mode accounts. */
  const signIn = useCallback((a: Account) => {
    setAccounts((all) => {
      const known = all[a.id];
      const merged = known ? { ...known, name: a.name, picture: a.picture ?? known.picture } : a;
      return { ...all, [a.id]: merged };
    });
    setSessionId(a.id);
  }, []);

  const update = useCallback((a: Account) => {
    if (a.cloud) {
      setCloudUser(a);
      void saveProfile(a.id, { name: a.name, sections: a.interests, seed_history: a.seedHistoryIds })
        .catch((e: Error) => console.warn("TopicLens: could not save profile", e.message));
    } else {
      setAccounts((all) => ({ ...all, [a.id]: a }));
    }
  }, []);

  const signOut = useCallback(() => {
    setSessionId(null);
    if (supabase) void supabase.auth.signOut();
  }, []);

  const signUpEmail = useCallback(async (name: string, email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: "Cloud accounts aren't configured." };
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
    if (error) return { error: friendly(error.message) };
    if (!data.session) return { notice: "Account created. Check your inbox to confirm your email, then sign in." };
    return {};
  }, []);

  const signInEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: "Cloud accounts aren't configured." };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: friendly(error.message) } : {};
  }, []);

  const signInGoogle = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { error: "Cloud accounts aren't configured." };
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    return error ? { error: friendly(error.message) } : {};
  }, []);

  const signInGuest = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { error: "Cloud accounts aren't configured." };
    const { error } = await supabase.auth.signInAnonymously();
    return error ? { error: friendly(error.message) } : {};
  }, []);

  // A demo reader chosen in this browser takes precedence; otherwise the Supabase session.
  const local = sessionId ? accounts[sessionId] ?? null : null;
  const account = local ?? cloudUser;
  return { account, ready, signIn, update, signOut, signUpEmail, signInEmail, signInGoogle, signInGuest };
}

// ── Google Identity Services (local mode only, loaded on demand) ────────────

interface GoogleId {
  initialize(opts: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let gisPromise: Promise<GoogleId> | null = null;

export function loadGoogleIdentity(): Promise<GoogleId> {
  gisPromise ??= new Promise<GoogleId>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Google sign-in did not load.")));
    s.onerror = () => {
      gisPromise = null;
      reject(new Error("Could not reach Google sign-in. Check your connection or ad blocker."));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}
