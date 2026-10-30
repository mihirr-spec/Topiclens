import { DEFAULT_PREFS, type Preferences } from "../engine/model";
import { supabase } from "./supabase";

/**
 * Reading and writing a signed-in user's data in Supabase (see supabase/schema.sql).
 * Row-level security limits every query to the signed-in user's own rows.
 *
 *   profiles      name, chosen sections, starting history, reset time
 *   preferences   topic sliders, mutes, More/Less, Not interested, passed-over counts
 *   interactions  append-only log of clicks, reads, likes, dislikes, dismissals, skips
 */

export interface CloudProfile {
  name: string;
  sections: string[];
  seed_history: string[];
  reset_at: string | null;
}

export type InteractionKind = "click" | "read" | "like" | "dislike" | "dismiss" | "skip";

export async function loadProfile(userId: string): Promise<CloudProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("name, sections, seed_history, reset_at").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as CloudProfile | null;
}

export async function saveProfile(userId: string, fields: Partial<CloudProfile>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("profiles").upsert({ id: userId, ...fields, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** Rebuilds a user's feed state: starting history + every click and read since the last reset, and saved preferences. */
export async function loadUserState(userId: string): Promise<{ historyIds: string[]; prefs: Preferences } | null> {
  if (!supabase) return null;
  const profile = await loadProfile(userId);
  let q = supabase.from("interactions").select("article_id, kind, created_at").eq("user_id", userId).in("kind", ["click", "read"]).order("created_at");
  if (profile?.reset_at) q = q.gt("created_at", profile.reset_at);
  const [{ data: reads, error: e1 }, { data: pref, error: e2 }] = await Promise.all([
    q,
    supabase.from("preferences").select("multipliers, muted, liked, disliked, dismissed, skipped").eq("user_id", userId).maybeSingle(),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  const historyIds = [...new Set([...(profile?.seed_history ?? []), ...(reads ?? []).map((r) => r.article_id as string)])];
  const prefs: Preferences = {
    ...DEFAULT_PREFS,
    ...(pref ?? {}),
    multipliers: (pref?.multipliers as Preferences["multipliers"]) ?? {},
    skipped: (pref?.skipped as Preferences["skipped"]) ?? {},
    sections: profile?.sections ?? [],
  };
  return { historyIds, prefs };
}

/** Fire-and-forget: the feed never waits on the network; failures are reported to the console. */
export function recordInteractions(rows: { kind: InteractionKind; article_id: string; rank?: number }[]): void {
  if (!supabase || rows.length === 0) return;
  void supabase.from("interactions").insert(rows).then(({ error }) => {
    if (error) console.warn("TopicLens: could not save interaction", error.message);
  });
}

const timers = new Map<string, number>();

/** Debounced so dragging a slider writes once, not once per step. */
export function savePreferences(userId: string, prefs: Preferences): void {
  if (!supabase) return;
  window.clearTimeout(timers.get(userId));
  timers.set(userId, window.setTimeout(() => {
    const { sections, ...rest } = prefs;
    void supabase!.from("preferences").upsert({
      user_id: userId,
      multipliers: rest.multipliers, muted: rest.muted, liked: rest.liked, disliked: rest.disliked,
      dismissed: rest.dismissed, skipped: rest.skipped ?? {}, updated_at: new Date().toISOString(),
    }).then(({ error }) => error && console.warn("TopicLens: could not save preferences", error.message));
    void saveProfile(userId, { sections: sections ?? [] }).catch((e: Error) => console.warn("TopicLens: could not save sections", e.message));
  }, 600));
}

/** "Reset my profile": history restarts from the seed; preferences go back to defaults (sections kept). */
export async function resetUser(userId: string): Promise<void> {
  if (!supabase) return;
  await saveProfile(userId, { reset_at: new Date().toISOString() });
  const { error } = await supabase.from("preferences").upsert({
    user_id: userId, multipliers: {}, muted: [], liked: [], disliked: [], dismissed: [], skipped: {}, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
