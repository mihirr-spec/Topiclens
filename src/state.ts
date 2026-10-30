import { useCallback, useEffect, useMemo, useState } from "react";
import { categoryName, TOPICS } from "./data/mind";
import { DEFAULT_PREFS, recommend, type Preferences } from "./engine/model";

/**
 * App state: per-user reading history, preferences and activity log.
 * Every action recomputes the ranking with the real engine before and after,
 * and the log records the computed difference.
 */

export interface LogEntry {
  id: number;
  at: string;
  kind: Action["type"];
  action: string;
  /** Ranking-change summary computed by diffing top-10 lists. */
  effects: string[];
  /** Coalesces rapid slider moves on the same topic into one entry. */
  mergeKey?: string;
  beforeTop: string[];
}

export interface UserState {
  historyIds: string[];
  prefs: Preferences;
  log: LogEntry[];
}

/** Per-account state, keyed by account id (see src/auth.ts). */
export type AppState = Record<string, UserState>;

/** The signed-in account, as far as the recommender cares. */
export interface ActiveUser {
  id: string;
  /** History a new or reset profile starts from. */
  seedHistoryIds: string[];
  /** Sections picked at sign-up; a new or reset profile starts with them as its preferences. */
  interests: string[];
}

export type Action =
  | { type: "read"; id: string }
  /** The reader opened a recommended story: a click, logged like a MIND click. `passedOver` are the unopened stories ranked above it. */
  | { type: "click"; id: string; passedOver?: string[] }
  | { type: "like"; id: string }
  | { type: "dislike"; id: string }
  | { type: "dismiss"; id: string }
  | { type: "set-multiplier"; topic: number; value: number }
  | { type: "toggle-mute"; topic: number }
  | { type: "set-sections"; sections: string[] }
  | { type: "reset-topics" }
  | { type: "reset-user" };

// v3: the app moved to MIND articles and the trained model.
const STORAGE_KEY = "topiclens:v3";
const TOP_N = 10;

function freshUser(active: Pick<ActiveUser, "seedHistoryIds" | "interests">): UserState {
  return { historyIds: [...active.seedHistoryIds], prefs: { ...structuredClone(DEFAULT_PREFS), sections: [...active.interests] }, log: [] };
}

function initialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppState) : {};
  } catch {
    return {};
  }
}

function topIds(u: UserState): string[] {
  return recommend(u.historyIds, u.prefs).ranked.slice(0, TOP_N).map((r) => r.id);
}

const uniq = (xs: string[]) => [...new Set(xs)];

function reduceUser(u: UserState, a: Action, active: ActiveUser): UserState {
  const p = u.prefs;
  switch (a.type) {
    case "click": {
      const skipped = { ...(p.skipped ?? {}) };
      for (const id of a.passedOver ?? []) skipped[id] = (skipped[id] ?? 0) + 1;
      return { ...u, historyIds: uniq([...u.historyIds, a.id]), prefs: { ...p, skipped } };
    }
    case "read":
      return { ...u, historyIds: uniq([...u.historyIds, a.id]) };
    case "like":
      return { ...u, prefs: { ...p, liked: uniq([...p.liked, a.id]), disliked: p.disliked.filter((x) => x !== a.id) } };
    case "dislike":
      return { ...u, prefs: { ...p, disliked: uniq([...p.disliked, a.id]), liked: p.liked.filter((x) => x !== a.id) } };
    case "dismiss":
      return { ...u, prefs: { ...p, dismissed: uniq([...p.dismissed, a.id]) } };
    case "set-multiplier":
      return { ...u, prefs: { ...p, multipliers: { ...p.multipliers, [a.topic]: a.value } } };
    case "toggle-mute":
      return {
        ...u,
        prefs: { ...p, muted: p.muted.includes(a.topic) ? p.muted.filter((t) => t !== a.topic) : [...p.muted, a.topic] },
      };
    case "set-sections":
      return { ...u, prefs: { ...p, sections: [...a.sections] } };
    case "reset-topics":
      return { ...u, prefs: { ...p, multipliers: {}, muted: [] } };
    case "reset-user":
      return freshUser(active);
  }
}

export function describeAction(a: Action, title: (id: string) => string, u: UserState): string {
  switch (a.type) {
    case "read": return `Read “${title(a.id)}” (added to history)`;
    case "click": {
      const n = a.passedOver?.length ?? 0;
      return `Opened “${title(a.id)}” (click added to history${n ? `; passed over ${n} ${n === 1 ? "story" : "stories"} above it` : ""})`;
    }
    case "like": return `More like this: “${title(a.id)}”`;
    case "dislike": return `Less like this: “${title(a.id)}”`;
    case "dismiss": return `Not interested: “${title(a.id)}”`;
    case "set-multiplier": return `Set interest in ${TOPICS[a.topic].label} to ×${a.value.toFixed(2)}`;
    case "toggle-mute":
      return `${u.prefs.muted.includes(a.topic) ? "Unmuted" : "Muted"} ${TOPICS[a.topic].label}`;
    case "set-sections": return `Set your sections to ${a.sections.map(categoryName).join(", ") || "none"}`;
    case "reset-topics": return "Reset all topic controls";
    case "reset-user": return "Reset profile";
  }
}

export function diffRankings(before: string[], after: string[], title: (id: string) => string): string[] {
  const entered = after.filter((id) => !before.includes(id));
  const left = before.filter((id) => !after.includes(id));
  const out: string[] = [];
  for (const id of entered) out.push(`↑ “${title(id)}” entered the top ${TOP_N} at #${after.indexOf(id) + 1}`);
  for (const id of left) out.push(`↓ “${title(id)}” left the top ${TOP_N} (was #${before.indexOf(id) + 1})`);
  const moved = after
    .filter((id) => before.includes(id) && before.indexOf(id) !== after.indexOf(id))
    .map((id) => ({ id, from: before.indexOf(id) + 1, to: after.indexOf(id) + 1 }))
    .sort((a, b) => Math.abs(b.from - b.to) - Math.abs(a.from - a.to))
    .slice(0, 3);
  for (const m of moved) out.push(`${m.to < m.from ? "↑" : "↓"} “${title(m.id)}” moved #${m.from} → #${m.to}`);
  if (out.length === 0) out.push(`No change to the top ${TOP_N}.`);
  return out;
}

export function useAppState(title: (id: string) => string, active: ActiveUser) {
  const [state, setState] = useState<AppState>(initialState);
  const { id: uid } = active;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: preferences simply won't persist */
    }
  }, [state]);

  const dispatch = useCallback(
    (a: Action) => {
      setState((s) => {
        const u = s[uid] ?? freshUser(active);
        const next = reduceUser(u, a, active);
        if (a.type === "reset-user") return { ...s, [uid]: next };

        const mergeKey = a.type === "set-multiplier" ? `mult-${a.topic}` : undefined;
        const prev = u.log[0];
        const merging = mergeKey && prev?.mergeKey === mergeKey;
        const beforeTop = merging ? prev.beforeTop : topIds(u);
        const entry: LogEntry = {
          id: (prev?.id ?? 0) + 1,
          at: new Date().toLocaleTimeString(),
          kind: a.type,
          action: describeAction(a, title, u),
          effects: diffRankings(beforeTop, topIds(next), title),
          mergeKey,
          beforeTop,
        };
        const log = merging ? [entry, ...u.log.slice(1)] : [entry, ...u.log].slice(0, 50);
        return { ...s, [uid]: { ...next, log } };
      });
    },
    [title, uid, active],
  );

  const user = useMemo(() => state[uid] ?? freshUser(active), [state, uid, active]);
  return { user, dispatch };
}
