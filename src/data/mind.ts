import raw from "./mind-app.json";

/**
 * MIND data and the trained model, exported by ml/build_app_data.py.
 *
 * Articles are real MIND-small news (Wu et al., ACL 2020): the most-shown
 * articles of the dev day plus the demo readers' histories. Each carries the
 * vectors the trained model reads (30 NMF topic weights, a 100-d LSA text
 * embedding, both quantised) and a popularity snapshot from the click logs.
 */

export interface Article {
  id: string;
  category: string;
  subcategory: string;
  title: string;
  abstract: string;
  url: string;
  /** In the recommendable pool (dev-day articles); history-only articles are false. */
  inPool: boolean;
  /** Topic proportions, sums to ~1. */
  topics: Float32Array;
  /** Unit-length LSA text embedding. */
  emb: Float32Array;
  pop: { prior_clicks: number; prior_ctr: number; exposure_before: number; hours_since_first_seen: number };
  image?: { src: string; page: string; author: string; license: string };
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  mindUser: string;
  interests: string[];
  historyIds: string[];
}

export interface Topic {
  index: number;
  label: string;
  words: string[];
}

export interface MetricCell {
  mean: number;
  ci95: [number, number];
}

export interface ResultRow {
  model: string;
  impressions: number;
  auc: MetricCell;
  mrr: MetricCell;
  ndcg5: MetricCell;
  ndcg10: MetricCell;
}

export interface LinearModel {
  name: string;
  features: string[];
  labels: string[];
  mean: number[];
  scale: number[];
  coef: number[];
  intercept: number;
}

function decode(b64: string, signed: boolean, scale: number): Float32Array {
  const bin = atob(b64);
  const out = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    const byte = bin.charCodeAt(i);
    out[i] = (signed && byte > 127 ? byte - 256 : byte) / scale;
  }
  return out;
}

function unit(v: Float32Array): Float32Array {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

export const META = raw.meta;
export const RESULTS: ResultRow[] = raw.results as ResultRow[];
export const PAPER = raw.paper;
export const IMPORTANCE: { feature: string; label: string; gain_share: number }[] = raw.importance;
export const MODEL: LinearModel = raw.model;
export const TOPICS: Topic[] = raw.topics;
export const PERSONAS: Persona[] = raw.personas;
export const SHOWCASE: { id: string; src: string; title: string; category: string; credit: Article["image"] & object }[] = raw.showcase;

export const ARTICLES: Article[] = raw.articles.map((a) => ({
  ...a,
  topics: decode(a.topics, false, raw.meta.topicScale),
  emb: unit(decode(a.emb, true, raw.meta.embScale)),
}));
export const POOL: Article[] = ARTICLES.filter((a) => a.inPool);
export const ARTICLE_BY_ID: ReadonlyMap<string, Article> = new Map(ARTICLES.map((a) => [a.id, a]));

const CATEGORY_NAMES: Record<string, string> = {
  autos: "Autos", entertainment: "Entertainment", finance: "Finance", foodanddrink: "Food & Drink", health: "Health",
  lifestyle: "Lifestyle", movies: "Movies", music: "Music", news: "News", sports: "Sports", travel: "Travel", tv: "TV",
  weather: "Weather",
};
export const categoryName = (c: string) => CATEGORY_NAMES[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
export const CATEGORIES: string[] = raw.categories;

/** The best model row by AUC, for headlines ("measured, not claimed"). */
export const BEST_RESULT: ResultRow = [...RESULTS].sort((a, b) => b.auc.mean - a.auc.mean)[0];
/** The row for the model the app actually ranks with. */
export const APP_MODEL_RESULT: ResultRow | undefined = RESULTS.find((r) => r.model === "Logistic regression");

/** Cold-start history for a new account: the most-shown pool articles of each chosen category, oldest exposure first. */
export function seedHistory(interests: string[], perCategory = 3): string[] {
  return interests.flatMap((c) => POOL.filter((a) => a.category === c).slice(0, perCategory).map((a) => a.id));
}

export const DATA_NOTICE =
  `Real data: ${POOL.length.toLocaleString("en-US")} Microsoft News articles from MIND-small (${META.license}). ` +
  `Ranked by a ${MODEL.name.toLowerCase()} trained on ${META.train_impressions.toLocaleString("en-US")} real visits.`;
