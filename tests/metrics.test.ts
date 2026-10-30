import { describe, expect, it } from "vitest";
import { auc, mrr, ndcgAtK, npmiCoherence, overlapAtK, summariseRanking } from "../src/engine/metrics";

describe("ranking metrics (MIND per-impression definitions)", () => {
  it("AUC is 1 for a perfect ranking, 0 for a reversed one, 0.5 for ties", () => {
    expect(auc([1, 0, 0], [0.9, 0.2, 0.1])).toBe(1);
    expect(auc([1, 0, 0], [0.1, 0.2, 0.9])).toBe(0);
    expect(auc([1, 0], [0.5, 0.5])).toBe(0.5);
  });

  it("AUC matches a hand-computed pairwise count", () => {
    // positives 0.8, 0.3; negatives 0.5, 0.1 → pairs won: (0.8>0.5),(0.8>0.1),(0.3>0.1) = 3 of 4
    expect(auc([1, 0, 1, 0], [0.8, 0.5, 0.3, 0.1])).toBeCloseTo(0.75);
  });

  it("AUC is undefined when an impression has a single class", () => {
    expect(auc([1, 1], [0.2, 0.3])).toBeNull();
  });

  it("MRR averages reciprocal ranks of clicked items", () => {
    // sorted labels: [0, 1, 0, 1] → (1/2 + 1/4) / 2
    expect(mrr([1, 0, 1, 0], [0.3, 0.9, 0.1, 0.2])).toBeCloseTo(0.375);
  });

  it("nDCG@k equals 1 for an ideal ranking and matches a hand computation", () => {
    expect(ndcgAtK([1, 0, 0], [3, 2, 1], 5)).toBe(1);
    // sorted [0,1,0]: dcg = 1/log2(3); idcg = 1
    expect(ndcgAtK([0, 1, 0], [3, 2, 1], 5)).toBeCloseTo(1 / Math.log2(3));
    // k cut-off: clicked item at position 3 with k=2 → 0
    expect(ndcgAtK([0, 0, 1], [3, 2, 1], 2)).toBe(0);
  });

  it("summariseRanking skips impressions where AUC is undefined", () => {
    const s = summariseRanking([
      { labels: [1, 0], scores: [1, 0] },
      { labels: [1, 1], scores: [1, 0] },
    ]);
    expect(s.usedForAuc).toBe(1);
    expect(s.auc).toBe(1);
  });
});

describe("NPMI coherence (paper Eq. 17)", () => {
  const docs = new Map<string, Set<string>>([
    ["a", new Set(["dog", "cat"])],
    ["b", new Set(["dog", "cat"])],
    ["c", new Set(["bank", "rate"])],
    ["d", new Set(["bank", "rate"])],
  ]);
  it("is close to 1 for words that always co-occur", () => {
    expect(npmiCoherence(["dog", "cat"], docs)).toBeCloseTo(1, 5);
  });
  it("is close to -1 for words that never co-occur", () => {
    expect(npmiCoherence(["dog", "bank"], docs)).toBeLessThan(-0.9);
  });
});

describe("overlapAtK", () => {
  it("counts shared items in the top k", () => {
    expect(overlapAtK(["a", "b", "c"], ["c", "x", "a"], 3)).toBeCloseTo(2 / 3);
  });
});
