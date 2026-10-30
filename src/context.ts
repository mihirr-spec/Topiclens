import { createContext, useContext } from "react";
import type { RecommendationResult } from "./engine/model";
import type { Action, UserState } from "./state";

export interface LensContextValue {
  user: UserState;
  userName: string;
  result: RecommendationResult;
  /** Same history, default preferences: the trained model before any user control. */
  untouched: RecommendationResult;
  dispatch: (a: Action) => void;
}

export const LensContext = createContext<LensContextValue | null>(null);

export function useLens(): LensContextValue {
  const v = useContext(LensContext);
  if (!v) throw new Error("useLens must be used inside LensContext");
  return v;
}

// Topic colours: coloured-pencil inks that stay readable on the newsprint background.
const TOPIC_COLORS = [
  "#c0392b", "#2449c4", "#1f7a3a", "#b35c00", "#7a3fa0", "#0f7c80", "#a3367a", "#5b6b00", "#8a4b2a", "#3c5a99",
  "#b0306a", "#2f7d5b", "#9a6a00", "#5a4fb0", "#86413c",
];

export function topicColor(index: number): string {
  return TOPIC_COLORS[index % TOPIC_COLORS.length];
}
