import { useCallback, useEffect, useState } from "react";
import { PERSONAS, seedHistory } from "./data/mind";

/**
 * Accounts and sign-in.
 *
 * TopicLens has no backend, so an account is a profile stored in this browser's
 * localStorage: who you are, the interests you picked, and the history that
 * seeds your feed. Google sign-in (Google Identity Services) only supplies your
 * name, email and picture; the ID token is decoded in the browser but not
 * verified, because no server relies on it.
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
}

export const GOOGLE_CLIENT_ID = (import.meta.env?.VITE_GOOGLE_CLIENT_ID ?? "").trim();

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

/** Reads the profile claims from a Google ID token (JWT). Unverified; see the note at the top. */
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

/** Current session. Signing in with an id seen before restores that profile (interests, history). */
export function useAuth() {
  const [accounts, setAccounts] = useState<Record<string, Account>>(() => read(ACCOUNTS_KEY, {}));
  const [sessionId, setSessionId] = useState<string | null>(() => read<string | null>(SESSION_KEY, null));

  useEffect(() => write(ACCOUNTS_KEY, accounts), [accounts]);
  useEffect(() => write(SESSION_KEY, sessionId), [sessionId]);

  const signIn = useCallback((a: Account) => {
    setAccounts((all) => {
      const known = all[a.id];
      // Keep a returning user's interests and history; refresh name/picture from the provider.
      const merged = known ? { ...known, name: a.name, picture: a.picture ?? known.picture } : a;
      return { ...all, [a.id]: merged };
    });
    setSessionId(a.id);
  }, []);

  const update = useCallback((a: Account) => setAccounts((all) => ({ ...all, [a.id]: a })), []);
  const signOut = useCallback(() => setSessionId(null), []);

  const account = sessionId ? accounts[sessionId] ?? null : null;
  return { account, signIn, update, signOut };
}

// ── Google Identity Services (loaded on demand) ─────────────────────────────

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
