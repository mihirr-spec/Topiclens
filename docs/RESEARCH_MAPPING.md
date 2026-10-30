# Research-to-prototype mapping

Source: Liu et al., *Topic-Centric Explanations for News Recommendation*, ACM TORS 3(2):17, 2024. https://doi.org/10.1145/3680295

The full text (25 pages, including appendices) was read. Details below were checked against it. **Not verified:**
- the original BATM paper (Liu et al., ACL Findings 2022), which TORS only summarises;
- the authors' GitHub code, which was not inspected;
- exact coherence values, which appear only as plots (Fig. 7) and are not transcribed.

## 1. Problem addressed by the paper

Neural news recommenders encode users and articles as latent embeddings, and their predictions are hard to understand. The paper argues that a lack of explanation can reduce trust and acceptance (Sec. 1). It asks:
- **RQ1:** Can an explainable NRS still recommend accurately?
- **RQ2:** Can it give explanations with coherent topics?

## 2. Existing approaches and limitations (as described in the paper)

- **Neural NRS** (DKN, NAML, NRMS, LSTUR, NPA) focus on accuracy and are black boxes.
- **Attention-based explanations** highlight words, but their faithfulness is debated (Jain & Wallace 2019; Wiegreffe & Pinter 2019). Prior NRS work showed case studies without quantitative evaluation.
- **Category labels** are coarse. A category contains many sub-topics that change over time.

## 3. The paper's actual contribution (verified)

**BATM-NR** uses the Bi-level Attention-based Topical Model as its news encoder.

**News encoder** (Eq. 1–6):
- Pre-trained GloVe word embeddings feed **K attention heads**, one per topic. Each head yields topic-term weights αᵏ and a topic vector hₖ.
- An **additive attention** layer over the topic vectors yields document-topic weights β and the news vector d = Σ βₖhₖ.

**User encoder:**
- *BATM-ATT:* additive attention over history news vectors gives user-news weights γ and u = Σ γᵢdᵢ (Eq. 7–9).
- *BATM-GRU:* a GRU variant (Eq. 10–13). It performed worse and is not fully explainable.

**Prediction and training:**
- Click score sᵢ = uᵀdᵢ.
- Trained with negative sampling (M = 4) and NCE loss (Eq. 14).

**Entropy regularisation** (Eq. 15–16) lowers each head's attention entropy so topics focus on fewer words.

**Explanation** (Sec. 3.3, Fig. 3):
- The global topic matrix T (K × V) gives topic descriptors.
- γ ranks which history articles contributed.
- β selects each article's main topics.
- Top topic words are highlighted in history and candidate articles to show topic matches.

**Evaluation:**
- Data: MIND-small and MIND-large.
- Ranking metrics: AUC, MRR, nDCG@5 and nDCG@10, averaged over 5 seeds.
- Topic coherence: NPMI (Eq. 17) and W2V similarity (Eq. 18) on the top 10 descriptors, after stopword/DF post-processing.
- Case studies (Fig. 8–9) and a comparison with NPA's attention (Table 6).

**Findings:**
- BATM-NR beats all listed baselines on all four metrics on both MIND versions (Table 5). Example: AUC 68.13 vs 67.26 (LSTUR) on MIND-small.
- K = 30 or 70 is best for accuracy.
- Larger λ and more topics raise coherence, so accuracy and coherence trade off. The paper recommends λ ∈ [0.001, 0.003] with K = 30 or 70.

**Future work named by the paper:**
- a user study;
- more interpretable topics;
- explanation cognitive load.

## 4. Inherited by TopicLens

| Paper concept | TopicLens counterpart | Fidelity |
|---|---|---|
| Topic-term matrix T (K×V), top-M descriptors | Row-normalised NMF H, top-10 descriptors | Same role, different method (NMF, not attention) |
| Document-topic weights β | Row-normalised NMF W | Same role |
| User vector u = Σ γᵢ dᵢ | u = Σ γᵢ βᵢ | Same form; γ fixed (recency), not learned |
| Click score uᵀd | uᵀβ | Same form; untrained |
| γ ranks contributing history news | Per-candidate history contributions | Refined: exact per-pair contribution |
| Highlight top topic words (Fig. 8) | Word highlights per top topic | Same idea |
| NPMI coherence (Eq. 17) | `npmiCoherence` | Same formula; different reference corpus |
| AUC/MRR/nDCG | `metrics.ts` + `eval:mind` | Same definitions |
| W2V coherence, entropy regularisation, NCE training, GloVe, body text | — | Not implemented |

## 5. New in TopicLens (proposed extension)

1. **Faithful-by-construction explanations.** Score = Σ topic contributions = Σ history contributions + feedback term. This sidesteps the attention-as-explanation debate *for this scorer*, at the cost of a much simpler model.
2. **Topic Explorer.** Per-topic 0–2× multipliers, mute (zero weight and hide articles with ≥ 25% share), and reset.
3. **Feedback loop.** More/Less like this shifts the profile. Not interested hides an article. Mark as read extends the history.
4. **Computed change log.** Every action records the resulting top-10 changes, computed by diffing the rankings.
5. **Baseline comparison view.** Same user and corpus, side by side, with overlap and rank deltas.
6. **Evidence labelling.** Every explanation element is tagged as computed, template, sample, paper or extension. A "what this does not know" box is included.

## 6. Why the extension may be useful (hypotheses)

- The paper's explanations are read-only. Letting users act on topics could increase perceived control and transparency, and correct wrong inferences such as a topic picked up from one incidental click.
- Exact decompositions avoid presenting attention weights as reasons when they may not be faithful.
- The paper lists a user study and cognitive load as future work; TopicLens provides a testbed for both.

## 7. Supported claims vs hypotheses

| Statement | Status |
|---|---|
| BATM-NR outperforms DKN/NAML/NRMS/LSTUR/NPA on MIND | **Supported by the paper** (Table 5) |
| BATM topics are coherent; entropy regularisation raises coherence | **Supported by the paper** (Fig. 7) |
| TopicLens explanations sum exactly to its scores | **Verified** by unit tests |
| TopicLens ranks as well as BATM or the baselines | **Not evaluated** (likely worse: untrained) |
| Topic controls improve understanding, trust or satisfaction | **Hypothesis**, not tested |
| Explanations do not overload users | **Hypothesis**, not tested |
