import { ARTICLE_BY_ID } from "../data/mind";
import type { Contribution, Recommendation } from "./model";

/**
 * Explanation sentences, filled from a fixed template with the computed
 * contributions of a Recommendation. No language model writes them; the UI
 * labels them "template text".
 */

/** Short, reader-facing names for the model's features. */
export const SIGNAL_NAME: Record<string, string> = {
  topic_sim: "Topic match with your reads",
  text_sim: "Similar wording to your reads",
  cat_affinity: "A section you read a lot",
  subcat_affinity: "A sub-section you read a lot",
  hist_len: "How much you've read",
  prior_clicks: "Clicked a lot earlier",
  prior_ctr: "High click rate earlier",
  exposure_before: "Widely shown already",
  hours_since_first_seen: "How long it has been out",
  impression_size: "Feed size",
  section_pref: "A section you chose",
};

export const signalName = (c: Pick<Contribution, "feature">) => SIGNAL_NAME[c.feature] ?? c.feature;

/** Positive reasons only, as shares of the total upward push. */
export function positiveShares(rec: Recommendation): { c: Contribution; share: number }[] {
  const pos = rec.contributions.filter((c) => c.contribution > 1e-6);
  const total = pos.reduce((s, c) => s + c.contribution, 0) || 1;
  return pos.map((c) => ({ c, share: c.contribution / total }));
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function shortExplanation(rec: Recommendation): string {
  const top = positiveShares(rec);
  if (!top.length) return "Nothing in your profile pushes this up; it ranks here because others score lower.";
  const lead = signalName(top[0].c).toLowerCase();
  const ev = rec.historyEvidence[0];
  const evTitle = ev && ev.pull > 0 ? ARTICLE_BY_ID.get(ev.id)?.title : undefined;
  const second = top[1] ? `, plus ${signalName(top[1].c).toLowerCase()}` : "";
  return evTitle && (top[0].c.feature === "topic_sim" || top[0].c.feature === "text_sim")
    ? `${capitalise(lead)}${second}. Closest past read: “${evTitle}”.`
    : `${capitalise(lead)}${second}.`;
}

export function longExplanation(rec: Recommendation): string[] {
  const out: string[] = [];
  const top = positiveShares(rec).slice(0, 2);
  for (const { c, share } of top) out.push(`${signalName(c)} did ${pct(share)} of the work pushing this up.`);
  const neg = rec.contributions.filter((c) => c.contribution < -1e-6)[0];
  if (neg) out.push(`Holding it back: ${signalName(neg).toLowerCase()}.`);
  out.push(`The model gives it a ${pct(rec.prob)} chance of a click, compared with other stories in your feed.`);
  return out;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Things the system cannot know, shown with every detailed explanation. */
export const LIMITATIONS_NOTE = [
  "It only sees what you read here. It doesn't know why you read something or whether you liked it.",
  "A shared topic or similar wording is an association, not proof you'll care.",
  "The model learned from Microsoft News readers in November 2019; their habits may not be yours.",
  "Popularity comes from that week's click logs, not from today.",
];
