"""
Train and evaluate click-prediction models on MIND-small.

    .venv/Scripts/python ml/train.py [--data .dataset-cache] [--train-impressions 60000]

Task: for every impression (a user shown N candidate articles, some clicked),
score each candidate; evaluate the ranking against the real clicks with the
MIND metrics (AUC, MRR, nDCG@5, nDCG@10), averaged over impressions.

Split: MIND-small train (Nov 9-14, 2019) for fitting, MIND-small dev (Nov 15)
for evaluation (the official test labels are not public). The last train day
is held out as a validation set for early stopping.

Leakage rules: no feature uses the click label of the row it describes.
Click popularity comes only from strictly earlier days; exposure counts and
"first seen" times use impression times, never labels.

Writes ml/results/{metrics.json, lgbm_model.txt, logreg.json}; ml/build_app_data.py
then exports what the app needs.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.decomposition import NMF, TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.kernel_approximation import Nystroem
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC

ROOT = Path(__file__).resolve().parents[1]
SEED = 7
K_TOPICS = 30
SVD_DIM = 100
MAX_HISTORY = 50

FEATURES = [
    "topic_sim", "text_sim", "cat_affinity", "subcat_affinity", "hist_len",
    "prior_clicks", "prior_ctr", "exposure_before", "hours_since_first_seen", "impression_size",
]
FEATURE_TEXT = {
    "topic_sim": "Topic match with your history (NMF topics)",
    "text_sim": "Text similarity to your history (LSA embedding)",
    "cat_affinity": "Share of your reads in this category",
    "subcat_affinity": "Share of your reads in this subcategory",
    "hist_len": "How much history you have (log)",
    "prior_clicks": "Clicks on this article on earlier days (log)",
    "prior_ctr": "Click-through rate on earlier days (smoothed)",
    "exposure_before": "Times shown to anyone before now (log)",
    "hours_since_first_seen": "Hours since the article first appeared (log)",
    "impression_size": "Number of articles shown together (log)",
}


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ── Loading ──────────────────────────────────────────────────────────────────

def load_news(data: Path) -> pd.DataFrame:
    cols = ["id", "category", "subcategory", "title", "abstract", "url", "title_entities", "abstract_entities"]
    frames = [pd.read_csv(data / d / "news.tsv", sep="\t", names=cols, quoting=3, dtype=str) for d in ("MINDsmall_train", "MINDsmall_dev")]
    news = pd.concat(frames).drop_duplicates("id").reset_index(drop=True)
    news[["title", "abstract"]] = news[["title", "abstract"]].fillna("")
    return news


def load_behaviors(data: Path, split: str) -> pd.DataFrame:
    b = pd.read_csv(data / f"MINDsmall_{split}" / "behaviors.tsv", sep="\t", names=["imp_id", "user", "time", "history", "impressions"], dtype=str)
    b["history"] = b["history"].fillna("")
    b["time"] = pd.to_datetime(b["time"], format="%m/%d/%Y %I:%M:%S %p")
    b["split"] = split
    b["imp_id"] = split + "-" + b["imp_id"]  # ids restart at 1 in each split
    return b


def explode(b: pd.DataFrame, news_index: dict[str, int]) -> pd.DataFrame:
    """One row per (impression, candidate) with the click label."""
    rows = b[["imp_id", "time", "split"]].assign(item=b["impressions"].str.split(" ")).explode("item")
    rows["news"] = rows["item"].str[:-2].map(news_index).astype(np.int64)
    rows["label"] = rows["item"].str[-1].astype(np.int8)
    return rows.drop(columns="item").reset_index(drop=True)


# ── Content representations ─────────────────────────────────────────────────

def content_vectors(news: pd.DataFrame, cache: Path | None = None):
    """NMF topics (W), LSA embeddings (E) and topic top-words. Cached so the app export reuses the exact fit."""
    if cache and (cache / "content_W.npy").exists():
        topic_words = json.loads((cache / "content_topics.json").read_text())
        return np.load(cache / "content_W.npy"), np.load(cache / "content_E.npy"), topic_words
    text = (news["title"] + ". " + news["abstract"]).tolist()
    tfidf = TfidfVectorizer(stop_words="english", min_df=3, max_df=0.5, sublinear_tf=True, max_features=40000)
    X = tfidf.fit_transform(text)
    log(f"TF-IDF {X.shape}")
    nmf = NMF(n_components=K_TOPICS, init="nndsvda", max_iter=300, random_state=SEED)
    W = nmf.fit_transform(X)
    W = W / np.maximum(W.sum(1, keepdims=True), 1e-12)
    terms = np.array(tfidf.get_feature_names_out())
    topic_words = [terms[np.argsort(-row)[:8]].tolist() for row in nmf.components_]
    log("NMF topics fitted")
    svd = TruncatedSVD(n_components=SVD_DIM, random_state=SEED)
    E = svd.fit_transform(X)
    E = E / np.maximum(np.linalg.norm(E, axis=1, keepdims=True), 1e-12)
    log("LSA embeddings fitted")
    W, E = W.astype(np.float32), E.astype(np.float32)
    if cache:
        np.save(cache / "content_W.npy", W)
        np.save(cache / "content_E.npy", E)
        (cache / "content_topics.json").write_text(json.dumps(topic_words))
    return W, E, topic_words


def history_profiles(histories: pd.Series, news_index, W, E, cat_codes, n_cat, subcat_codes, n_subcat):
    """Mean topic vector, mean embedding, and category/subcategory shares per unique history string."""
    uniq = histories.unique()
    rows, cols, vals, lens = [], [], [], np.zeros(len(uniq), dtype=np.float32)
    for i, h in enumerate(uniq):
        ids = [news_index[x] for x in h.split()[-MAX_HISTORY:] if x in news_index] if h else []
        lens[i] = len(h.split()) if h else 0
        if ids:
            rows += [i] * len(ids)
            cols += ids
            vals += [1.0 / len(ids)] * len(ids)
    H = sp.csr_matrix((vals, (rows, cols)), shape=(len(uniq), W.shape[0]), dtype=np.float32)
    user_topic = H @ W
    user_emb = H @ E
    user_emb /= np.maximum(np.linalg.norm(user_emb, axis=1, keepdims=True), 1e-12)
    onehot = lambda codes, n: sp.csr_matrix((np.ones(len(codes), np.float32), (np.arange(len(codes)), codes)), shape=(len(codes), n))
    user_cat = np.asarray((H @ onehot(cat_codes, n_cat)).todense(), dtype=np.float32)
    user_subcat = np.asarray((H @ onehot(subcat_codes, n_subcat)).todense(), dtype=np.float32)
    return {h: i for i, h in enumerate(uniq)}, user_topic, user_emb, user_cat, user_subcat, lens


# ── Features ─────────────────────────────────────────────────────────────────

def build_features(rows, behaviors, news, news_index, W, E):
    cat_codes, cats = pd.factorize(news["category"])
    subcat_codes, subcats = pd.factorize(news["subcategory"].fillna("none"))
    h_index, u_topic, u_emb, u_cat, u_subcat, h_len = history_profiles(
        behaviors["history"], news_index, W, E, cat_codes, len(cats), subcat_codes, len(subcats))
    hist_of_imp = behaviors.set_index("imp_id")["history"].map(h_index)
    h = rows["imp_id"].map(hist_of_imp).to_numpy()
    n = rows["news"].to_numpy()

    f = pd.DataFrame(index=rows.index)
    chunk = 1_000_000
    topic_sim = np.empty(len(rows), np.float32)
    text_sim = np.empty(len(rows), np.float32)
    for s in range(0, len(rows), chunk):
        sl = slice(s, s + chunk)
        topic_sim[sl] = np.einsum("ij,ij->i", u_topic[h[sl]], W[n[sl]])
        text_sim[sl] = np.einsum("ij,ij->i", u_emb[h[sl]], E[n[sl]])
    f["topic_sim"] = topic_sim
    f["text_sim"] = text_sim
    f["cat_affinity"] = u_cat[h, cat_codes[n]]
    f["subcat_affinity"] = u_subcat[h, subcat_codes[n]]
    f["hist_len"] = np.log1p(h_len[h])
    f["category"] = pd.Categorical(cats[cat_codes[n]])

    # Exposure before this impression (label-free, causal): order all rows by time.
    order = np.argsort(rows["time"].to_numpy(), kind="stable")
    exposure = np.empty(len(rows), np.float32)
    exposure[order] = pd.Series(n[order]).groupby(n[order]).cumcount().to_numpy()
    f["exposure_before"] = np.log1p(exposure)
    first_seen = rows.groupby("news")["time"].transform("min")
    f["hours_since_first_seen"] = np.log1p((rows["time"] - first_seen).dt.total_seconds().to_numpy() / 3600)
    f["impression_size"] = np.log(rows.groupby("imp_id")["news"].transform("size").to_numpy())
    return f, cats.tolist()


def add_prior_popularity(rows: pd.DataFrame, f: pd.DataFrame) -> None:
    """Clicks/impressions from strictly earlier days of the *training* log only (dev labels are never used)."""
    day = rows["time"].dt.floor("D")
    train = rows["split"] == "train"
    daily = rows[train].assign(day=day[train]).groupby(["news", "day"])["label"].agg(["sum", "size"]).reset_index()
    days = sorted(day.unique())
    prior_clicks = np.zeros(len(rows), np.float32)
    prior_shows = np.zeros(len(rows), np.float32)
    for d in days:
        before = daily[daily["day"] < d].groupby("news")[["sum", "size"]].sum()
        mask = (day == d).to_numpy()
        idx = rows.loc[mask, "news"]
        prior_clicks[mask] = idx.map(before["sum"]).fillna(0).to_numpy()
        prior_shows[mask] = idx.map(before["size"]).fillna(0).to_numpy()
    global_ctr = rows.loc[train, "label"].mean()
    f["prior_clicks"] = np.log1p(prior_clicks)
    f["prior_ctr"] = (prior_clicks + 10 * global_ctr) / (prior_shows + 10)


# ── Metrics (MIND definitions, per impression, then averaged) ────────────────

def per_impression_metrics(groups: np.ndarray, y: np.ndarray, s: np.ndarray) -> pd.DataFrame:
    df = pd.DataFrame({"g": groups, "y": y, "s": s})
    df["rank_desc"] = df.groupby("g")["s"].rank(method="first", ascending=False)
    df["rank_asc"] = df.groupby("g")["s"].rank(method="average", ascending=True)
    g = df.groupby("g")
    pos = g["y"].sum()
    size = g["y"].size()
    neg = size - pos
    pos_rank_sum = df[df["y"] == 1].groupby("g")["rank_asc"].sum().reindex(pos.index, fill_value=0)
    auc = (pos_rank_sum - pos * (pos + 1) / 2) / (pos * neg)
    mrr = df.assign(rr=df["y"] / df["rank_desc"]).groupby("g")["rr"].sum() / pos

    def ndcg(k: int) -> pd.Series:
        gain = (df["y"] / np.log2(df["rank_desc"] + 1)).where(df["rank_desc"] <= k, 0)
        dcg = gain.groupby(df["g"]).sum()
        ideal = pos.clip(upper=k).map(lambda p: (1 / np.log2(np.arange(2, p + 2))).sum())
        return dcg / ideal

    out = pd.DataFrame({"auc": auc, "mrr": mrr, "ndcg5": ndcg(5), "ndcg10": ndcg(10)})
    return out[(pos > 0) & (neg > 0)]


def summarise(per_imp: pd.DataFrame, rng: np.random.Generator, n_boot: int = 500) -> dict:
    vals = per_imp.to_numpy()
    idx = rng.integers(0, len(vals), size=(n_boot, len(vals)))
    boot = vals[idx].mean(axis=1)
    lo, hi = np.percentile(boot, [2.5, 97.5], axis=0)
    return {m: {"mean": round(float(vals[:, i].mean()) * 100, 2), "ci95": [round(float(lo[i]) * 100, 2), round(float(hi[i]) * 100, 2)]}
            for i, m in enumerate(per_imp.columns)}


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(ROOT / ".dataset-cache"))
    ap.add_argument("--train-impressions", type=int, default=60000, help="Training impressions sampled (time-ordered sample keeps all days).")
    args = ap.parse_args()
    data = Path(args.data)
    rng = np.random.default_rng(SEED)
    t_start = time.time()

    news = load_news(data)
    news_index = {nid: i for i, nid in enumerate(news["id"])}
    behaviors = pd.concat([load_behaviors(data, "train"), load_behaviors(data, "dev")], ignore_index=True)
    log(f"news={len(news):,} impressions: train={int((behaviors.split == 'train').sum()):,} dev={int((behaviors.split == 'dev').sum()):,}")

    W, E, topic_words = content_vectors(news, data)
    rows = explode(behaviors, news_index)
    log(f"candidate rows={len(rows):,} (click rate {rows['label'].mean():.4f})")

    f, categories = build_features(rows, behaviors, news, news_index, W, E)
    add_prior_popularity(rows, f)
    log("features built")

    is_train = (rows["split"] == "train").to_numpy()
    is_dev = ~is_train
    train_days = sorted(rows.loc[is_train, "time"].dt.floor("D").unique())
    is_valid = is_train & (rows["time"].dt.floor("D") == train_days[-1]).to_numpy()
    is_fit = is_train & ~is_valid

    fit_imps = rows.loc[is_fit, "imp_id"].unique()
    if len(fit_imps) > args.train_impressions:
        keep = set(rng.choice(fit_imps, args.train_impressions, replace=False))
        is_fit &= rows["imp_id"].isin(keep).to_numpy()

    def grouped(mask):
        sub = rows[mask].sort_values(["imp_id"], kind="stable")
        return sub.index.to_numpy(), sub.groupby("imp_id", sort=False).size().to_numpy()

    fit_idx, fit_groups = grouped(is_fit)
    val_idx, val_groups = grouped(is_valid)
    dev_idx = np.flatnonzero(is_dev)
    y = rows["label"].to_numpy()
    X = f[FEATURES + ["category"]]
    log(f"fit rows={len(fit_idx):,} ({len(fit_groups):,} imps)  valid rows={len(val_idx):,}  dev rows={len(dev_idx):,}")

    # LightGBM LambdaRank
    ranker = lgb.LGBMRanker(
        objective="lambdarank", n_estimators=1000, learning_rate=0.03, num_leaves=31, min_child_samples=400, reg_lambda=5.0,
        subsample=0.8, subsample_freq=1, colsample_bytree=0.9, random_state=SEED, verbose=-1,
    )
    ranker.fit(
        X.iloc[fit_idx], y[fit_idx], group=fit_groups,
        eval_set=[(X.iloc[val_idx], y[val_idx])], eval_group=[val_groups], eval_at=[5, 10],
        callbacks=[lgb.early_stopping(50, verbose=False)],
    )
    log(f"LightGBM best iteration {ranker.best_iteration_}")

    # Logistic regression on standardised numeric features (explainable: score = Σ w_j x_j)
    scaler = StandardScaler().fit(f[FEATURES].iloc[fit_idx])
    logreg = LogisticRegression(max_iter=1000, C=1.0, class_weight="balanced")
    logreg.fit(scaler.transform(f[FEATURES].iloc[fit_idx]), y[fit_idx])
    log("Logistic regression fitted")

    # Classic supervised models on the same standardised features. Each is fitted on a random sample of
    # the fit rows (KNN and kernel methods do not scale to 2M rows on a laptop) and scored on all dev rows.
    def sample(n):
        return rng.choice(fit_idx, min(n, len(fit_idx)), replace=False)
    Zfit = lambda idx: scaler.transform(f[FEATURES].iloc[idx])
    classic = {}
    s_knn = sample(60_000)
    classic["KNN classifier (k=50)"] = KNeighborsClassifier(n_neighbors=50, weights="distance", algorithm="kd_tree", n_jobs=-1).fit(Zfit(s_knn), y[s_knn])
    s_svm = sample(400_000)
    classic["Linear SVM"] = LinearSVC(C=0.05, class_weight="balanced", max_iter=5000).fit(Zfit(s_svm), y[s_svm])
    s_rbf = sample(150_000)
    classic["Kernel SVM (RBF, Nystroem)"] = make_pipeline(
        Nystroem(kernel="rbf", gamma=0.1, n_components=300, random_state=SEED),
        LinearSVC(C=0.05, class_weight="balanced", max_iter=5000),
    ).fit(Zfit(s_rbf), y[s_rbf])
    s_rf = sample(400_000)
    classic["Random forest"] = RandomForestClassifier(
        n_estimators=200, max_depth=14, min_samples_leaf=50, class_weight="balanced_subsample", n_jobs=-1, random_state=SEED,
    ).fit(Zfit(s_rf), y[s_rf])
    log("KNN, linear SVM, kernel SVM and random forest fitted")

    score_dir = data / "scores"
    score_dir.mkdir(exist_ok=True)

    def cached(name: str, compute) -> np.ndarray:
        """Dev scores are saved per model as soon as they exist, so an interrupted run resumes instead of restarting."""
        path = score_dir / (name.lower().replace(" ", "_").replace("(", "").replace(")", "").replace(",", "").replace("=", "") + ".npy")
        if path.exists():
            arr = np.load(path)
            if len(arr) == len(dev_idx):
                log(f"{name}: reusing saved dev scores")
                return arr
        arr = np.asarray(compute(), dtype=np.float64)
        np.save(path, arr)
        log(f"{name}: dev scores computed and saved")
        return arr

    def classic_scores(model, X: np.ndarray, chunk: int = 200_000) -> np.ndarray:
        out = []
        for i in range(0, len(X), chunk):
            part = X[i:i + chunk]
            out.append(model.predict_proba(part)[:, 1] if hasattr(model, "predict_proba") else model.decision_function(part))
        return np.concatenate(out)

    dev_groups = rows["imp_id"].to_numpy()[dev_idx]
    Xd = f.iloc[dev_idx]
    Zdev = scaler.transform(Xd[FEATURES])
    scores = {
        "Random": rng.random(len(dev_idx)),
        "Popularity (earlier-day clicks)": Xd["prior_ctr"].to_numpy() + 1e-6 * Xd["exposure_before"].to_numpy(),
        "Recent exposure": Xd["exposure_before"].to_numpy(),
        "Category match": Xd["cat_affinity"].to_numpy() + 1e-3 * Xd["subcat_affinity"].to_numpy(),
        "Text similarity (LSA)": Xd["text_sim"].to_numpy(),
        "Topic match (NMF)": Xd["topic_sim"].to_numpy(),
        "Logistic regression": logreg.decision_function(scaler.transform(Xd[FEATURES])),
        **{name: cached(name, lambda m=m: classic_scores(m, Zdev)) for name, m in classic.items()},
        "LightGBM LambdaRank": ranker.predict(X.iloc[dev_idx], num_iteration=ranker.best_iteration_),
    }

    # Hybrid: LightGBM with the neural model's score as one more feature. Trained only on the
    # held-out last train day (the neural model never saw it), early-stopped on 20% of its impressions.
    neural_path = data / "nrms_scores.npy"
    if neural_path.exists() and len(np.load(neural_path, mmap_mode="r")) == len(rows):
        f["neural_score"] = np.load(neural_path)
        val_imps = rows.loc[is_valid, "imp_id"].unique()
        stop_imps = set(rng.choice(val_imps, len(val_imps) // 5, replace=False))
        in_stop = rows["imp_id"].isin(stop_imps).to_numpy()
        h_fit_idx, h_fit_groups = grouped(is_valid & ~in_stop)
        h_stop_idx, h_stop_groups = grouped(is_valid & in_stop)
        Xh = f[FEATURES + ["neural_score", "category"]]
        hybrid = lgb.LGBMRanker(
            objective="lambdarank", n_estimators=1000, learning_rate=0.03, num_leaves=31, min_child_samples=400, reg_lambda=5.0,
            subsample=0.8, subsample_freq=1, colsample_bytree=0.9, random_state=SEED, verbose=-1,
        )
        hybrid.fit(Xh.iloc[h_fit_idx], y[h_fit_idx], group=h_fit_groups, eval_set=[(Xh.iloc[h_stop_idx], y[h_stop_idx])],
                   eval_group=[h_stop_groups], eval_at=[5, 10], callbacks=[lgb.early_stopping(50, verbose=False)])
        scores["Neural NRMS (GPU, MiniLM news encoder)"] = Xh["neural_score"].to_numpy()[dev_idx]
        scores["Hybrid: LightGBM + neural score"] = hybrid.predict(Xh.iloc[dev_idx], num_iteration=hybrid.best_iteration_)
        log(f"Hybrid trained on {len(h_fit_groups):,} held-out impressions (best iteration {hybrid.best_iteration_})")
    else:
        log("No neural scores found (run ml/train_neural.py); skipping the hybrid model")
    results = []
    for name, s in scores.items():
        per = per_impression_metrics(dev_groups, y[dev_idx], s)
        results.append({"model": name, "impressions": int(len(per)), **summarise(per, rng)})
        log(f"{name:34s} AUC {results[-1]['auc']['mean']:.2f}  MRR {results[-1]['mrr']['mean']:.2f}  nDCG@5 {results[-1]['ndcg5']['mean']:.2f}  nDCG@10 {results[-1]['ndcg10']['mean']:.2f}")

    gain = ranker.booster_.feature_importance(importance_type="gain")
    names = ranker.booster_.feature_name()
    importance = sorted(({"feature": n_, "label": FEATURE_TEXT.get(n_, "Article category"), "gain_share": round(float(g) / float(gain.sum()), 4)} for n_, g in zip(names, gain)), key=lambda d: -d["gain_share"])
    coefs = sorted(({"feature": n_, "label": FEATURE_TEXT[n_], "weight": round(float(w), 4)} for n_, w in zip(FEATURES, logreg.coef_[0])), key=lambda d: -abs(d["weight"]))

    report = {
        "dataset": {
            "name": "MIND-small (Microsoft News Dataset)",
            "citation": "Fangzhao Wu et al. 2020. MIND: A Large-scale Dataset for News Recommendation. ACL 2020.",
            "url": "https://msnews.github.io/",
            "license": "Microsoft Research License Terms (non-commercial research)",
            "news": int(len(news)),
            "train_impressions": int((behaviors.split == "train").sum()),
            "dev_impressions": int((behaviors.split == "dev").sum()),
            "users": int(behaviors["user"].nunique()),
            "candidate_rows": int(len(rows)),
            "click_rate": round(float(rows["label"].mean()), 4),
            "fit_impressions": int(len(fit_groups)),
            "validation_impressions": int(len(val_groups)),
        },
        "protocol": "Fit on MIND-small train (last day held out for early stopping), evaluate on MIND-small dev. Metrics are averaged per impression; 95% CIs from 500 bootstrap resamples of dev impressions.",
        "results": results,
        "lightgbm": {"best_iteration": int(ranker.best_iteration_), "importance": importance},
        "logistic_regression": {"coefficients": coefs, "intercept": round(float(logreg.intercept_[0]), 4)},
        "topics": topic_words,
        "paper_reference": {"model": "BATM-NR (Liu et al., 2024, Table 5)", "auc": 68.13, "mrr": 32.62, "ndcg5": 36.36, "ndcg10": 42.46},
        "runtime_seconds": round(time.time() - t_start),
    }
    out = ROOT / "ml" / "results"
    out.mkdir(parents=True, exist_ok=True)
    (out / "metrics.json").write_text(json.dumps(report, indent=1))
    ranker.booster_.save_model(str(out / "lgbm_model.txt"), num_iteration=ranker.best_iteration_)
    (out / "logreg.json").write_text(json.dumps({
        "features": FEATURES, "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
        "coef": logreg.coef_[0].tolist(), "intercept": float(logreg.intercept_[0]),
    }, indent=1))
    log(f"done in {report['runtime_seconds']}s; wrote ml/results")


if __name__ == "__main__":
    main()
