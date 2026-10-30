# TopicLens: an explainable news recommender trained on real clicks

TopicLens recommends news stories and shows exactly why each one was picked. It is trained and tested on
**MIND**, the Microsoft News Dataset (real, anonymised logs of what people were shown and clicked), and builds
on:

> Dairui Liu, Derek Greene, Irene Li, Xuefei Jiang, and Ruihai Dong. 2024. **Topic-Centric Explanations for
> News Recommendation.** *ACM Transactions on Recommender Systems* 3, 2, Article 17. https://doi.org/10.1145/3680295

**Best result:** a hybrid of LightGBM and a GPU-trained neural model reaches **AUC 66.60** on 73,152 MIND test
visits it never saw (the paper's model: 68.13). The app ranks with a logistic regression (AUC 63.84) because every
pick then splits exactly into its reasons.

| Doc | Contents |
|---|---|
| [docs/TopicLens_Report.pdf](docs/TopicLens_Report.pdf) | 3-page report: purpose, dataset, train/test split, models, metrics (regenerate with `ml/make_report.py`) |
| [docs/EVALUATION_PLAN.md](docs/EVALUATION_PLAN.md) | All 14 models' results, how to read them, and the user-study plan |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | The ML pipeline and the browser app |
| [docs/RESEARCH_MAPPING.md](docs/RESEARCH_MAPPING.md) | What comes from the paper and what is new |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | An 8-minute walkthrough |
| [PROJECT_BRIEF.txt](PROJECT_BRIEF.txt) | Design brief: pages, copy, visual direction |

## What it recommends from

The goal is to put the most relevant news first for each reader, using:

| Signal | How it is used |
|---|---|
| Reading and clicking history | The trained model's profile: topic match, wording and section shares of the last 50 reads. Opening a story counts as a click and joins the history. |
| Preferred sections | Chosen at sign-up and editable in "Your sections"; stories from them get an explicit +2.0 log-odds boost. |
| Interaction with earlier recommendations | "Skip-above" implicit feedback: unopened stories ranked above an opened one lose 0.5 log-odds per pass (max 3). |
| Explicit feedback | More / Less like this shift the profile; Not interested and Less like this hide stories; topic sliders and mutes. |

Explanations support the ranking rather than lead it: each card shows a one-line reason, and the full breakdown is
in a collapsed "Why am I seeing this?" panel.

## How it works

1. **Data:** MIND-small. 65,238 articles, 156,965 training visits (9-14 Nov 2019), 73,152 test visits (15 Nov).
2. **Features** for every (reader, candidate story) pair, none using the label of its own row:
   topic match (NMF, K = 30), text similarity (100-d LSA), section and sub-section affinity, earlier-day clicks
   and click rate, prior exposure, freshness, history length, impression size.
3. **Models**, all trained on the same data and tested on the same unseen visits:
   - logistic regression (the app's ranker: every score splits exactly into per-signal reasons)
   - LightGBM LambdaRank (gradient-boosted trees)
   - KNN classifier, linear SVM, kernel SVM (RBF via Nystroem), random forest
   - neural NRMS-style recommender on the GPU (MiniLM news encoder + self-attention user encoder)
   - hybrid: LightGBM with the neural score as a feature, trained on a day the neural model never saw
   - baselines: random, popularity, recent exposure, category match, text similarity, topic match
4. **Metrics:** AUC, MRR, nDCG@5, nDCG@10 (MIND per-impression definitions), with 95% bootstrap CIs.
5. **App:** the trained logistic regression runs in the browser on exported article vectors. Readers can open
   "Why am I seeing this?", push back (More / Less like this, Not interested), and tune or mute topics.

## Run it

```bash
npm install
npm run dev              # the app, http://localhost:5173
npm test                 # engine, data and page tests
```

Rebuild the models (Python 3.11, `.venv`; MIND-small in `.dataset-cache/MINDsmall_{train,dev}/`):

```bash
python -m venv .venv
.venv/Scripts/python -m pip install numpy pandas scikit-learn lightgbm scipy
.venv/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cu128
.venv/Scripts/python -m pip install sentence-transformers

npm run train:neural     # GPU model (~8 min on an RTX 3050), writes neural scores
npm run train            # features + all other models + hybrid -> ml/results/metrics.json
npm run export           # app data + Wikimedia photos -> src/data/mind-app.json, public/showcase/
```

## Sign-in

Google (needs `VITE_GOOGLE_CLIENT_ID` in `.env.local`: create an OAuth "Web application" client in Google
Cloud Console and add your dev URL as an authorised JavaScript origin), email (local profile, no password),
guest, or a demo reader (a real anonymised MIND user). There is no server: profiles live in the browser's
localStorage, and the Google ID token is decoded but not verified.

## Limitations

- Titles and abstracts only (no article body); the best model here sits a few AUC points below the paper's.
- Offline evaluation on logged clicks; whether the explanations help people still needs a user study.
- Popularity signals are a snapshot of one week in November 2019.

## Credits

- Paper: Liu et al. (2024), ACM TORS. Data: Wu et al. (2020), MIND, ACL; Microsoft Research License (non-commercial).
- Photos: Wikimedia Commons, credited per image on the landing page.
