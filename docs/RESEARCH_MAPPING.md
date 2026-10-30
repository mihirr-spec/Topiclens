# Research-to-project mapping

Source: Liu et al., *Topic-Centric Explanations for News Recommendation*, ACM TORS 3(2):17, 2024.
https://doi.org/10.1145/3680295

Not verified here: the original BATM paper (ACL Findings 2022), which TORS summarises; the authors' code; exact
coherence values, which appear only as plots (Fig. 7).

## 1. The paper in brief

**Problem.** Neural news recommenders (DKN, NAML, NRMS, LSTUR, NPA) rank well but are black boxes, which can
undermine trust. Attention-weight explanations are of debated faithfulness, and categories are too coarse.

**Contribution: BATM-NR.**
- News encoder: K word-level attention heads, one per topic (topic-term weights α), then additive attention over
  topics (document-topic weights β); news vector d = Σ βₖhₖ.
- User encoder: additive attention over history news (weights γ); u = Σ γᵢdᵢ.
- Click score uᵀd, trained with negative sampling (4 negatives) and NCE loss; entropy regularisation sharpens topics.
- Explanations: topic descriptors, history articles ranked by γ, highlighted topic words.

**Findings.** On MIND-small BATM-NR reaches AUC 68.13 / MRR 32.62 / nDCG@5 36.36 / nDCG@10 42.46 (Table 5), above
LSTUR, NAML, NPA, NRMS and DKN. Future work: a user study, more interpretable topics, explanation workload.

## 2. What TopicLens inherits

| Paper | TopicLens | Fidelity |
|---|---|---|
| MIND-small, AUC / MRR / nDCG@5 / nDCG@10 per impression | Same data, same metrics, same definitions (`ml/train.py`) | Same; we train on MIND-small train and test on dev |
| Negative sampling with 4 negatives, softmax over 1 + 4 | Same objective for the neural model (`ml/train_neural.py`) | Same |
| NRMS-style user encoder (a baseline in the paper) | Multi-head self-attention + additive attention over the last 50 reads | Close; news encoder is frozen MiniLM, not trained word attention |
| Topics with descriptors | NMF on TF-IDF, K = 30 (the paper's best K), top-8 words, named by a person | Same role, different method |
| History articles that drove a pick | Exact per-history-article share of the topic and text terms | Refined: exact, not attention |
| Highlighted topic words (Fig. 8) | Topic words highlighted in the story | Same idea |

## 3. What is new in TopicLens

1. **A model trained on clicks whose explanations are exact.** The app's logistic regression scores
   intercept + Σ wⱼzⱼ, so the "Why" panel is the score itself, split into ten signals.
2. **A wide model comparison on one protocol.** 14 rankers: rules, KNN, linear and kernel SVMs, random forest,
   LightGBM, logistic regression, a GPU neural model, and a hybrid of LightGBM and the neural score.
3. **User control.** Topic sliders (0-2×), mutes, More / Less like this, Not interested, with a computed log of
   how each action changed the top 10.
4. **Evidence labelling.** Every number is tagged as computed, template, real data, from the paper, or new.

## 4. Claims and their status

| Statement | Status |
|---|---|
| BATM-NR beats the neural baselines on MIND | Supported by the paper (Table 5) |
| Our hybrid reaches AUC 66.60 on MIND-small dev | **Measured** (95% CI about ±0.2) |
| The app's explanations sum exactly to its scores | **Verified** by unit tests |
| Our models match the paper's accuracy | **No**: best is 1.5 AUC below; titles and abstracts only, no body text |
| Controls and explanations improve understanding or trust | **Hypothesis**: needs the user study in EVALUATION_PLAN.md |
