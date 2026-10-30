import { ARTICLE_BY_ID, MODEL, POOL, TOPICS, type Article } from "../data/mind";

/**
 * TopicLens ranker: the logistic regression trained in ml/train.py, run in the
 * browser on the same features.
 *
 *   z_j = (x_j - mean_j) / scale_j          (the training standardisation)
 *   logit = intercept + sum_j w_j z_j       (exact; each term is a reason)
 *   P(click) = 1 / (1 + e^-logit)
 *
 * User profile (as in training): the mean topic vector and mean text embedding
 * of the last 50 articles read, plus category / subcategory shares.
 * TopicLens extensions on top of the trained model: More / Less like this shift
 * the profile, topic sliders scale it, mutes hide articles, Not interested hides one.
 */

export const MAX_HISTORY = 50;
const K = TOPICS.length;

export interface Preferences {
  /** Topic index -> multiplier in [0, 2]; missing means 1. */
  multipliers: Record<number, number>;
  muted: number[];
  liked: string[];
  disliked: string[];
  dismissed: string[];
  /** Sections the reader says they prefer (MIND categories); each gets an explicit boost. */
  sections?: string[];
  /** Article id -> times it was shown above a story the reader opened, and passed over. */
  skipped?: Record<string, number>;
}

export const DEFAULT_PREFS: Preferences = { multipliers: {}, muted: [], liked: [], disliked: [], dismissed: [], sections: [], skipped: {} };

export const PARAMS = {
  /** How strongly More / Less like this shift the profile. */
  feedbackStrength: 0.5,
  /** Articles with at least this share of a muted topic are hidden. */
  muteThreshold: 0.25,
  /**
   * Log-odds added to stories from a section the reader chose. The trained model weighs
   * section share lightly (sub-section and wording carry most of it), so stated preferences
   * get their own explicit, visible term instead of being diluted into that signal.
   * 2.0 log-odds (about 7x the odds) brings 1-4 stories from a newly chosen section into a
   * strongly sports-reading demo reader's top 10 while their history still leads.
   */
  sectionBoost: 2.0,
  /**
   * Implicit feedback from earlier recommendations ("skip-above", Joachims 2002): opening the
   * story at rank r means the unopened stories ranked above it were seen and passed over.
   * Each pass costs this many log-odds, up to maxSkips.
   */
  skipPenalty: 0.5,
  maxSkips: 3,
};

export function effectiveMultiplier(prefs: Preferences, topic: number): number {
  if (prefs.muted.includes(topic)) return 0;
  return prefs.multipliers[topic] ?? 1;
}

export interface Profile {
  /** Last-50 history articles present in the data, oldest first. */
  history: Article[];
  /** Mean topic vector of the history alone. */
  inferred: Float32Array;
  /** After feedback and multipliers: the vector actually scored. */
  adjusted: Float32Array;
  /** Unnormalised mean embedding (history + feedback) and its length. */
  emb: Float32Array;
  embNorm: number;
  categoryShare: Map<string, number>;
  subcategoryShare: Map<string, number>;
  historyLength: number;
  /** Sections the reader chose (stated preference). */
  sections: ReadonlySet<string>;
  /** Times each story was passed over in earlier feeds. */
  skipped: Readonly<Record<string, number>>;
}

const mean = (vs: Float32Array[], dim: number) => {
  const out = new Float32Array(dim);
  for (const v of vs) for (let i = 0; i < dim; i++) out[i] += v[i] / vs.length;
  return out;
};

const shares = (keys: string[]) => {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1 / keys.length);
  return m;
};

export function buildProfile(historyIds: string[], prefs: Preferences): Profile {
  const history = historyIds.slice(-MAX_HISTORY).map((id) => ARTICLE_BY_ID.get(id)).filter((a): a is Article => !!a);
  const liked = prefs.liked.map((id) => ARTICLE_BY_ID.get(id)).filter((a): a is Article => !!a);
  const disliked = prefs.disliked.map((id) => ARTICLE_BY_ID.get(id)).filter((a): a is Article => !!a);
  const dim = history[0]?.emb.length ?? liked[0]?.emb.length ?? 100;
  const eta = PARAMS.feedbackStrength;

  const inferred = history.length ? mean(history.map((a) => a.topics), K) : new Float32Array(K);
  const likedT = liked.length ? mean(liked.map((a) => a.topics), K) : new Float32Array(K);
  const dislikedT = disliked.length ? mean(disliked.map((a) => a.topics), K) : new Float32Array(K);
  const adjusted = inferred.map((v, k) => Math.max(0, v + eta * (likedT[k] - dislikedT[k])) * effectiveMultiplier(prefs, k));

  const histE = history.length ? mean(history.map((a) => a.emb), dim) : new Float32Array(dim);
  const likedE = liked.length ? mean(liked.map((a) => a.emb), dim) : new Float32Array(dim);
  const dislikedE = disliked.length ? mean(disliked.map((a) => a.emb), dim) : new Float32Array(dim);
  const emb = histE.map((v, i) => v + eta * (likedE[i] - dislikedE[i]));
  const embNorm = Math.hypot(...emb) || 1;

  const pool = [...history, ...liked];
  return {
    history, inferred, adjusted, emb, embNorm,
    categoryShare: shares(pool.map((a) => a.category)),
    subcategoryShare: shares(pool.map((a) => a.subcategory)),
    historyLength: historyIds.length,
    sections: new Set(prefs.sections ?? []),
    skipped: prefs.skipped ?? {},
  };
}

export interface Contribution {
  feature: string;
  label: string;
  /** Raw feature value. */
  value: number;
  /** w_j * z_j: this feature's push on the logit, relative to an average article. */
  contribution: number;
}

export interface HistoryEvidence {
  id: string;
  /** This past read's share of the topic + text terms of the logit. */
  pull: number;
}

export interface Recommendation {
  id: string;
  rank: number;
  logit: number;
  /** Predicted click probability. */
  prob: number;
  /** All features, largest |contribution| first. intercept + sum = logit. */
  contributions: Contribution[];
  historyEvidence: HistoryEvidence[];
  /** Article's strongest topics. */
  topTopics: number[];
}

export type HiddenReason =
  | { kind: "muted-topic"; topic: number; share: number }
  | { kind: "less-like-this" }
  | { kind: "not-interested" };

export interface RecommendationResult {
  profile: Profile;
  ranked: Recommendation[];
  hidden: { id: string; reason: HiddenReason }[];
}

const dot = (a: Float32Array, b: Float32Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

const fIndex = (name: string) => MODEL.features.indexOf(name);
const F = {
  topic: fIndex("topic_sim"), text: fIndex("text_sim"), cat: fIndex("cat_affinity"), subcat: fIndex("subcat_affinity"),
  hist: fIndex("hist_len"), clicks: fIndex("prior_clicks"), ctr: fIndex("prior_ctr"), exposure: fIndex("exposure_before"),
  age: fIndex("hours_since_first_seen"), size: fIndex("impression_size"),
};

export function featureValues(profile: Profile, a: Article): number[] {
  const x = new Array<number>(MODEL.features.length).fill(0);
  x[F.topic] = dot(profile.adjusted, a.topics);
  x[F.text] = dot(profile.emb, a.emb) / profile.embNorm;
  x[F.cat] = profile.categoryShare.get(a.category) ?? 0;
  x[F.subcat] = profile.subcategoryShare.get(a.subcategory) ?? 0;
  x[F.hist] = Math.log1p(profile.historyLength);
  x[F.clicks] = a.pop.prior_clicks;
  x[F.ctr] = a.pop.prior_ctr;
  x[F.exposure] = a.pop.exposure_before;
  x[F.age] = a.pop.hours_since_first_seen;
  // Every article in one feed shares the impression size, so it cannot change the order: held at its mean.
  x[F.size] = MODEL.mean[F.size];
  return x;
}

export function score(profile: Profile, a: Article): { logit: number; contributions: Contribution[] } {
  const x = featureValues(profile, a);
  const contributions = x.map((v, j) => ({
    feature: MODEL.features[j], label: MODEL.labels[j], value: v,
    contribution: MODEL.coef[j] * ((v - MODEL.mean[j]) / MODEL.scale[j]),
  }));
  // TopicLens extension on top of the trained model: an explicit boost for chosen sections.
  if (profile.sections.has(a.category)) {
    contributions.push({ feature: "section_pref", label: "A section you chose", value: 1, contribution: PARAMS.sectionBoost });
  }
  const skips = Math.min(profile.skipped[a.id] ?? 0, PARAMS.maxSkips);
  if (skips > 0) {
    contributions.push({ feature: "skipped", label: "You passed over this before", value: skips, contribution: -PARAMS.skipPenalty * skips });
  }
  const logit = MODEL.intercept + contributions.reduce((s, c) => s + c.contribution, 0);
  contributions.sort((p, q) => Math.abs(q.contribution) - Math.abs(p.contribution));
  return { logit, contributions };
}

/** Each past read's exact share of the history-dependent part of the topic and text terms. */
function historyEvidence(profile: Profile, a: Article, prefs: Preferences): HistoryEvidence[] {
  const H = profile.history.length;
  if (!H) return [];
  const wT = MODEL.coef[F.topic] / MODEL.scale[F.topic];
  const wE = MODEL.coef[F.text] / MODEL.scale[F.text];
  const mult = Array.from({ length: K }, (_, k) => effectiveMultiplier(prefs, k));
  return profile.history
    .map((h) => {
      let t = 0;
      for (let k = 0; k < K; k++) t += mult[k] * h.topics[k] * a.topics[k];
      const e = dot(h.emb, a.emb) / profile.embNorm;
      return { id: h.id, pull: (wT * t + wE * e) / H };
    })
    .sort((p, q) => q.pull - p.pull);
}

export function topTopicsOf(a: Article, n = 3): number[] {
  return Array.from(a.topics, (w, k) => ({ w, k }))
    .sort((p, q) => q.w - p.w || p.k - q.k)
    .slice(0, n)
    .filter((x) => x.w > 0.05)
    .map((x) => x.k);
}

export function recommend(historyIds: string[], prefs: Preferences, candidates: Article[] = POOL): RecommendationResult {
  const profile = buildProfile(historyIds, prefs);
  const read = new Set(historyIds);
  const hidden: RecommendationResult["hidden"] = [];
  const scored: Omit<Recommendation, "rank">[] = [];

  for (const a of candidates) {
    if (read.has(a.id)) continue;
    if (prefs.dismissed.includes(a.id)) {
      hidden.push({ id: a.id, reason: { kind: "not-interested" } });
      continue;
    }
    if (prefs.disliked.includes(a.id)) {
      hidden.push({ id: a.id, reason: { kind: "less-like-this" } });
      continue;
    }
    const mutedHit = prefs.muted
      .map((t) => ({ t, share: a.topics[t] }))
      .filter((m) => m.share >= PARAMS.muteThreshold)
      .sort((p, q) => q.share - p.share)[0];
    if (mutedHit) {
      hidden.push({ id: a.id, reason: { kind: "muted-topic", topic: mutedHit.t, share: mutedHit.share } });
      continue;
    }
    const { logit, contributions } = score(profile, a);
    scored.push({ id: a.id, logit, prob: sigmoid(logit), contributions, historyEvidence: historyEvidence(profile, a, prefs), topTopics: topTopicsOf(a) });
  }

  scored.sort((p, q) => q.logit - p.logit || (p.id < q.id ? -1 : 1));
  return { profile, ranked: scored.map((r, i) => ({ ...r, rank: i + 1 })), hidden };
}

/** Fraction of the top-k items in `a` that also appear in the top-k of `b`. */
export function overlapAtK(a: string[], b: string[], k: number): number {
  const sb = new Set(b.slice(0, k));
  const top = a.slice(0, k);
  return top.length ? top.filter((x) => sb.has(x)).length / top.length : 0;
}

/** Single-signal baselines for the Compare page (each measured in ml/train.py). */
export type BaselineKind = "popularity" | "topic";
export function baselineRanking(historyIds: string[], kind: BaselineKind): { id: string; rank: number; score: number }[] {
  const profile = buildProfile(historyIds, DEFAULT_PREFS);
  const read = new Set(historyIds);
  return POOL.filter((a) => !read.has(a.id))
    .map((a) => ({ id: a.id, score: kind === "popularity" ? a.pop.prior_ctr : dot(profile.inferred, a.topics) }))
    .sort((p, q) => q.score - p.score || (p.id < q.id ? -1 : 1))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
