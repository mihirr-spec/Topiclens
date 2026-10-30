# Evaluation

Status legend: **Measured** (computed on MIND by this project), **From the paper**, **Not yet evaluated**.

## A. Recommendation accuracy (Measured)

Protocol: train on MIND-small train (156,965 visits, 9-14 Nov 2019; last day held out for early stopping), test on
MIND-small dev (73,152 visits, 15 Nov). Metrics are per impression, then averaged; 95% confidence intervals come from
500 bootstrap resamples of impressions (about ±0.2 for AUC). Reproduce with `npm run train:neural && npm run train`.

| Model | AUC | MRR | nDCG@5 | nDCG@10 |
|---|---|---|---|---|
| Hybrid: LightGBM + neural score | **66.60** | **32.05** | **35.47** | **41.64** |
| Logistic regression (runs the app) | 63.84 | 30.56 | 33.54 | 39.61 |
| LightGBM LambdaRank | 63.83 | 30.58 | 33.26 | 39.46 |
| Linear SVM | 63.74 | 30.56 | 33.52 | 39.59 |
| Neural NRMS (GPU, MiniLM news encoder) | 63.14 | 29.75 | 32.20 | 38.64 |
| Random forest | 61.79 | 29.26 | 31.95 | 38.15 |
| Category match (rule) | 60.94 | 29.24 | 31.71 | 37.64 |
| Kernel SVM (RBF, Nystroem) | 60.40 | 27.86 | 30.27 | 36.82 |
| Popularity (earlier-day clicks) | 58.61 | 27.24 | 28.66 | 34.73 |
| Text similarity (LSA) | 56.03 | 25.61 | 26.89 | 33.39 |
| KNN classifier (k=50) | 55.66 | 25.97 | 27.85 | 34.00 |
| Topic match (NMF) | 51.83 | 22.34 | 22.41 | 29.35 |
| Recent exposure | 51.69 | 23.00 | 24.40 | 30.47 |
| Random | 50.07 | 21.91 | 22.38 | 28.66 |
| *BATM-NR, from the paper (Table 5)* | *68.13* | *32.62* | *36.36* | *42.46* |

**Reading the table.**
- The hybrid combines the neural model's text understanding with popularity and freshness, which the neural model
  alone cannot see; it is the best model, 1.5 AUC below the paper.
- Topic match alone is barely better than chance: hand-set topic overlap does not predict clicks well.
- KNN struggles with 10 mixed-scale signals and a 4% click rate; trained linear and tree models do far better.
- Not directly comparable to the paper: it reads article bodies and trains on its own split.

## B. Explanations (Measured)

| Check | Status |
|---|---|
| Faithfulness: intercept + Σ contributions = score, for every pick | Unit-tested (`tests/model.test.ts`) |
| History evidence sums to the history part of the topic and text terms | Unit-tested |
| Human-rated clarity and usefulness | **Not yet evaluated** |

## C. User study (Not yet evaluated)

**Design.** Within-subjects, two conditions: a plain ranked list vs TopicLens (explanations + controls), counterbalanced,
different demo readers per condition, about 20-30 participants (confirm with a power analysis).

**Tasks per condition.**
1. "Why was story X recommended?" Free answer, scored against the top contributing signal and past read.
2. "Make the feed show less of a topic you don't want." Time and actions until satisfied.
3. Rate 3 recommendations for relevance.

**Measures and hypotheses.**
- H1 comprehension accuracy improves with explanations.
- H2 perceived transparency, control and trust improve (items adapted from ResQue, Pu, Chen & Hu, RecSys 2011).
- H3 time and actions to a satisfying list fall with controls.
- H4 workload does not rise (NASA-TLX).

**Analysis.** Paired t-test or Wilcoxon per measure, or a mixed-effects model with condition and order; report effect
sizes. **Ethics:** institutional approval and informed consent; no personal data beyond questionnaire answers.
