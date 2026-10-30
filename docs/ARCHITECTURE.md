# Architecture

Everything runs client-side. The engine (`src/engine/`) has no React dependency, so the same code serves the UI, the tests and the MIND evaluation CLI.

```mermaid
flowchart LR
  A[Sample articles<br/>title + abstract] --> V[Vocabulary + TF-IDF<br/>text.ts, sparse.ts]
  V --> N[NMF, K=12, 6 restarts<br/>nmf.ts]
  N --> TM[Topic model<br/>T: K×V, β per article,<br/>named topics<br/>topicModel.ts]
  H[Reading history<br/>sample users] --> P
  TM --> P[User profile<br/>u = Σ γᵢ βᵢ]
  C[Controls & feedback<br/>sliders, mute,<br/>more/less, not interested]:::new --> P
  P --> S[Scorer<br/>s = uᵀβ_c<br/>recommender.ts]
  TM --> S
  S --> E[Explainer<br/>topic + history decomposition,<br/>word highlights<br/>explain.ts]
  E --> UI[TopicLens UI<br/>Feed · Explorer · Compare ·<br/>Evaluation · About]:::new
  V --> B[TF-IDF baseline<br/>baseline.ts]
  B --> UI
  UI --> C
  UI --> L[Activity log<br/>top-10 diffs<br/>state.ts]:::new
  classDef new fill:#fde7d9,stroke:#c2410c
```

Orange nodes are TopicLens additions.

## Data flow for one action

1. A user clicks e.g. **Mute "Health & Medicine"**.
2. `state.ts` computes the current top 10, applies the action to the user's `Preferences`, and recomputes the top 10.
3. It writes a log entry with the computed difference.
4. The new state is persisted to `localStorage`.
5. `App.tsx` recomputes `recommend()` (TopicLens), `recommend()` with default prefs (for Compare) and `baselineRecommend()`.
6. All pages re-render from the new context.

## Module responsibilities

| Module | Responsibility |
|---|---|
| `text.ts` | Tokeniser, stopwords, corpus-driven plural merge, DF-filtered vocabulary, display segmentation |
| `sparse.ts` | CSR matrices, TF-IDF |
| `nmf.ts` | Seeded PRNG, sparse multiplicative-update NMF, reconstruction error |
| `topicModel.ts` | Fit (with restarts), T and β, descriptors, rule-based naming, word highlighting |
| `recommender.ts` | Profile (γ, feedback, multipliers), candidate filtering, scoring, exact decompositions |
| `baseline.ts` | TF-IDF cosine baseline |
| `explain.ts` | Template sentences from computed values; limitations text |
| `metrics.ts` | AUC, MRR, nDCG@k (MIND definitions), NPMI (Eq. 17), overlap@k |
| `mind.ts` / `scripts/eval-mind.ts` | MIND TSV parsing and offline evaluation |
| `state.ts` | Per-user state, actions, change log, persistence |
