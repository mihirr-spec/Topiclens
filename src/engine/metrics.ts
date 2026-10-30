/**
 * Evaluation metrics.
 *
 * Ranking metrics follow the per-impression definitions used by the MIND
 * benchmark (Wu et al., ACL 2020) and reported in Table 5 of the paper:
 * AUC, MRR, nDCG@5, nDCG@10, averaged over impressions.
 * Topic coherence follows the paper's NPMI definition (Eq. 17).
 */

/** ROC AUC via the rank-sum (Mann–Whitney) formulation, ties get average rank. Null if one class is absent. */
export function auc(labels: number[], scores: number[]): number | null {
  const n = labels.length;
  const pos = labels.filter((l) => l > 0).length;
  const neg = n - pos;
  if (pos === 0 || neg === 0) return null;
  const order = scores.map((s, i) => ({ s, i })).sort((a, b) => a.s - b.s);
  const ranks = new Array<number>(n);
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && order[j + 1].s === order[i].s) j++;
    const avg = (i + j) / 2 + 1;
    for (let m = i; m <= j; m++) ranks[order[m].i] = avg;
    i = j + 1;
  }
  let rankSumPos = 0;
  labels.forEach((l, i) => {
    if (l > 0) rankSumPos += ranks[i];
  });
  return (rankSumPos - (pos * (pos + 1)) / 2) / (pos * neg);
}

function orderByScore(labels: number[], scores: number[]): number[] {
  return scores
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => labels[x.i]);
}

/** MIND-style MRR: Σ(label / rank) / Σ label over the score-sorted impression. */
export function mrr(labels: number[], scores: number[]): number | null {
  const total = labels.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const sorted = orderByScore(labels, scores);
  return sorted.reduce((s, l, i) => s + l / (i + 1), 0) / total;
}

function dcg(sortedLabels: number[], k: number): number {
  let s = 0;
  for (let i = 0; i < Math.min(k, sortedLabels.length); i++) s += (2 ** sortedLabels[i] - 1) / Math.log2(i + 2);
  return s;
}

/** nDCG@k with gain 2^rel − 1 and log2(rank + 1) discount. */
export function ndcgAtK(labels: number[], scores: number[], k: number): number | null {
  const ideal = dcg([...labels].sort((a, b) => b - a), k);
  if (ideal === 0) return null;
  return dcg(orderByScore(labels, scores), k) / ideal;
}

export interface ImpressionResult {
  labels: number[];
  scores: number[];
}

export interface RankingSummary {
  impressions: number;
  usedForAuc: number;
  auc: number;
  mrr: number;
  ndcg5: number;
  ndcg10: number;
}

/** Averages metrics over impressions, skipping impressions where a metric is undefined. */
export function summariseRanking(results: ImpressionResult[]): RankingSummary {
  const mean = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
  };
  const aucs = results.map((r) => auc(r.labels, r.scores));
  return {
    impressions: results.length,
    usedForAuc: aucs.filter((x) => x !== null).length,
    auc: mean(aucs),
    mrr: mean(results.map((r) => mrr(r.labels, r.scores))),
    ndcg5: mean(results.map((r) => ndcgAtK(r.labels, r.scores, 5))),
    ndcg10: mean(results.map((r) => ndcgAtK(r.labels, r.scores, 10))),
  };
}

/**
 * NPMI topic coherence (paper Eq. 17): mean over descriptor pairs of
 *   log((P(wi,wj) + ε) / (P(wi)P(wj))) / −log(P(wi,wj) + ε),
 * with probabilities estimated from document co-occurrence in a reference corpus.
 */
export function npmiCoherence(
  descriptors: string[],
  docTermSets: ReadonlyMap<string, ReadonlySet<string>>,
  epsilon = 1e-12,
): number {
  const docs = [...docTermSets.values()];
  const n = docs.length;
  if (n === 0 || descriptors.length < 2) return NaN;
  const p = (pred: (s: ReadonlySet<string>) => boolean) => docs.filter(pred).length / n;
  let total = 0;
  let pairs = 0;
  for (let j = 1; j < descriptors.length; j++) {
    for (let i = 0; i < j; i++) {
      const wi = descriptors[i];
      const wj = descriptors[j];
      const pi = p((s) => s.has(wi));
      const pj = p((s) => s.has(wj));
      const pij = p((s) => s.has(wi) && s.has(wj));
      if (pi === 0 || pj === 0) {
        pairs++;
        total += -1;
        continue;
      }
      total += Math.log((pij + epsilon) / (pi * pj)) / -Math.log(pij + epsilon);
      pairs++;
    }
  }
  return total / pairs;
}

/** Fraction of the top-k items in `a` that also appear in the top-k of `b`. */
export function overlapAtK(a: string[], b: string[], k: number): number {
  const sb = new Set(b.slice(0, k));
  const top = a.slice(0, k);
  return top.length ? top.filter((x) => sb.has(x)).length / top.length : 0;
}
