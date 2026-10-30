# Evaluation plan

Status legend: **Measured** (computed by this prototype), **Implemented, not run**, **Not yet evaluated**.

## A. Recommendation accuracy

| Metric | Definition | Status |
|---|---|---|
| AUC | Per-impression ROC AUC, averaged (MIND) | Implemented & unit-tested; **not yet evaluated** on data |
| MRR | Σ(label/rank)/Σlabel per impression | same |
| nDCG@5, nDCG@10 | gain 2^rel−1, log₂(rank+1) discount | same |

**Protocol:**
1. Download MIND-small under its licence.
2. Run `npm run eval:mind -- --dir MINDsmall_dev`.
3. Report TopicLens and the TF-IDF baseline side by side, with the number of impressions and cold-start impressions.

**Comparability:** results must **not** be put in the same table as the paper's Table 5 without caveats. The paper trains on its own split, uses body text and neural models; TopicLens is untrained and uses title + abstract.

## B. Topic quality and explanations

| Metric | Status |
|---|---|
| NPMI coherence (paper Eq. 17), top-10 descriptors | **Measured** on the sample corpus (Evaluation page). Not comparable to the paper (different reference corpus). |
| W2V coherence (paper Eq. 18) | Not computed: no trained embeddings |
| Explanation coverage: share of top-10 items with ≥1 positive topic contribution *and* ≥1 positive history contribution | **Measured** (3 sample users) |
| Faithfulness: max \|score − Σ contributions\| | **Measured** (≈ machine precision) and unit-tested |
| Human-rated clarity / usefulness | **Not yet evaluated** |

## C. Interaction

| Metric | Status |
|---|---|
| Number and type of preference changes | Counted per browser session (Evaluation page, section 4); **not study data** |
| Feedback response rate: actions that changed the top 10 | Counted per session; **not study data** |
| Ease of understanding, trust, perceived transparency/control | **Not yet evaluated**; needs the study below |

## D. Proposed user study

**Design:**
- Within-subjects, two conditions: **Baseline** (ranked list, "Recommended for you") vs **TopicLens** (explanations + controls).
- Condition order is counterbalanced, and each condition uses a different sample user.
- Target: ~20–30 participants (to be confirmed by a power analysis).

**Tasks per condition:**
1. "Why was article X recommended?" Free answer, scored against the model's top contributing topic and history item.
2. "Make the list show less of a topic you are not interested in." Time and number of actions until satisfied.
3. Rate 3 recommendations for relevance.

**Measures:**
- Comprehension accuracy (H1).
- Post-condition questionnaire on transparency, control and trust (H2), with items adapted from an established framework such as ResQue (Pu, Chen & Hu, RecSys 2011).
- Time and actions to satisfaction (H3).
- NASA-TLX workload (H4).

**Analysis:** paired t-test or Wilcoxon per measure, or a mixed-effects model with condition and order as factors. Report effect sizes.

**Ethics:** obtain institutional approval and informed consent. Collect no personal data beyond questionnaire answers.

Until this study is run, every statement about user benefit is a hypothesis.
