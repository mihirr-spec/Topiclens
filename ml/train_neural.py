"""
Neural news recommender (NRMS-style) on MIND-small, trained on the GPU.

    .venv/Scripts/python ml/train_neural.py [--epochs 4]

News encoder: frozen MiniLM sentence embedding of "title. abstract" (computed
once, cached) + a learned category embedding -> projection (256-d).
User encoder: multi-head self-attention over the last 50 clicked articles,
then additive attention pooling (Wu et al., NRMS, 2019). Score = dot(user, news).
Training: for every click, the clicked article vs 4 non-clicked articles from
the same impression, softmax cross-entropy (the standard MIND set-up).
Model selection: best epoch by AUC on the last train day; reported on dev.

Appends its row to ml/results/metrics.json (run ml/train.py first), saves
ml/results/nrms.pt, and writes per-candidate scores for the hybrid model.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F

sys.path.insert(0, str(Path(__file__).resolve().parent))
from train import ROOT, SEED, load_behaviors, load_news, log, per_impression_metrics, summarise  # noqa: E402

MAX_HISTORY = 50
NEG = 4
DIM = 256


class NewsEncoder(nn.Module):
    def __init__(self, text_dim: int, n_cat: int):
        super().__init__()
        self.cat = nn.Embedding(n_cat, 32)
        self.proj = nn.Sequential(nn.Linear(text_dim + 32, DIM), nn.GELU(), nn.Dropout(0.2), nn.Linear(DIM, DIM))

    def forward(self, text: torch.Tensor, cat: torch.Tensor) -> torch.Tensor:
        return self.proj(torch.cat([text, self.cat(cat)], dim=-1))


class AdditiveAttention(nn.Module):
    def __init__(self, dim: int, hidden: int = 128):
        super().__init__()
        self.score = nn.Sequential(nn.Linear(dim, hidden), nn.Tanh(), nn.Linear(hidden, 1, bias=False))

    def forward(self, x: torch.Tensor, mask: torch.Tensor):
        a = self.score(x).squeeze(-1).masked_fill(~mask, -1e4)
        w = torch.softmax(a, dim=-1) * mask
        w = w / w.sum(-1, keepdim=True).clamp_min(1e-9)
        return (w.unsqueeze(-1) * x).sum(1), w


class NRMS(nn.Module):
    def __init__(self, text: torch.Tensor, cats: torch.Tensor, n_cat: int):
        super().__init__()
        self.register_buffer("text", text)   # (N, 384) frozen sentence embeddings
        self.register_buffer("cats", cats)   # (N,)
        self.news = NewsEncoder(text.shape[1], n_cat)
        self.self_attn = nn.MultiheadAttention(DIM, num_heads=8, dropout=0.2, batch_first=True)
        self.pool = AdditiveAttention(DIM)
        self.empty_user = nn.Parameter(torch.zeros(DIM))

    def encode_news(self, idx: torch.Tensor) -> torch.Tensor:
        return self.news(self.text[idx], self.cats[idx])

    def encode_user(self, hist: torch.Tensor, mask: torch.Tensor):
        h = self.encode_news(hist)
        safe = mask.clone()
        safe[:, 0] |= ~mask.any(1)  # keep attention defined for empty histories
        a, _ = self.self_attn(h, h, h, key_padding_mask=~safe)
        u, w = self.pool(a + h, safe)
        u = torch.where(mask.any(1, keepdim=True), u, self.empty_user.expand_as(u))
        return u, w

    def forward(self, hist, mask, cands):
        u, _ = self.encode_user(hist, mask)
        c = self.encode_news(cands)
        return torch.einsum("bd,bkd->bk", u, c)


def embed_news(news: pd.DataFrame, cache: Path, device: str) -> np.ndarray:
    if cache.exists():
        return np.load(cache)
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", device=device)
    text = (news["title"] + ". " + news["abstract"]).tolist()
    emb = model.encode(text, batch_size=256, show_progress_bar=False, convert_to_numpy=True, normalize_embeddings=True)
    np.save(cache, emb.astype(np.float32))
    return emb


def history_matrix(histories: pd.Series, news_index: dict[str, int]):
    H = np.zeros((len(histories), MAX_HISTORY), dtype=np.int64)
    M = np.zeros((len(histories), MAX_HISTORY), dtype=bool)
    for i, h in enumerate(histories):
        ids = [news_index[x] for x in h.split()[-MAX_HISTORY:] if x in news_index] if h else []
        H[i, : len(ids)] = ids
        M[i, : len(ids)] = True
    return H, M


def training_samples(b: pd.DataFrame, news_index, rng):
    """(impression row, clicked id, 4 sampled non-clicked ids) per click."""
    rows, pos, negs = [], [], []
    for r, imp in enumerate(b["impressions"]):
        items = imp.split()
        p = [news_index[x[:-2]] for x in items if x.endswith("-1")]
        n = [news_index[x[:-2]] for x in items if x.endswith("-0")]
        if not n:
            continue
        for c in p:
            rows.append(r)
            pos.append(c)
            negs.append(rng.choice(n, NEG, replace=len(n) < NEG))
    return np.array(rows), np.array(pos), np.stack(negs)


@torch.no_grad()
def score_impressions(model, b, H, M, news_index, device, batch=512):
    model.eval()
    groups, labels, scores = [], [], []
    users = []
    for s in range(0, len(b), batch):
        u, _ = model.encode_user(torch.from_numpy(H[s:s + batch]).to(device), torch.from_numpy(M[s:s + batch]).to(device))
        users.append(u)
    U = torch.cat(users)
    all_news = model.encode_news(torch.arange(model.text.shape[0], device=device))
    for r, (imp_id, imp) in enumerate(zip(b["imp_id"], b["impressions"])):
        items = imp.split()
        ids = torch.tensor([news_index[x[:-2]] for x in items], device=device)
        scores.append((all_news[ids] @ U[r]).cpu().numpy())
        labels.append(np.array([int(x[-1]) for x in items], dtype=np.int8))
        groups.append(np.full(len(items), r))
    return np.concatenate(groups), np.concatenate(labels), np.concatenate(scores)


def write_candidate_scores(model, train_b, dev_b, news_index, device, data: Path) -> None:
    """One score per candidate row, in the row order ml/train.py builds (train impressions, then dev)."""
    parts = []
    for b in (train_b, dev_b):
        H, M = history_matrix(b["history"], news_index)
        parts.append(score_impressions(model, b, H, M, news_index, device)[2])
    np.save(data / "nrms_scores.npy", np.concatenate(parts).astype(np.float32))
    log("wrote per-candidate neural scores for the hybrid model")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(ROOT / ".dataset-cache"))
    ap.add_argument("--epochs", type=int, default=4)
    ap.add_argument("--batch", type=int, default=256)
    ap.add_argument("--score-only", action="store_true", help="Load ml/results/nrms.pt and only write per-candidate scores for the hybrid model.")
    args = ap.parse_args()
    data = Path(args.data)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch.manual_seed(SEED)
    rng = np.random.default_rng(SEED)
    t0 = time.time()
    log(f"device={device}" + (f" ({torch.cuda.get_device_name(0)})" if device == "cuda" else ""))

    news = load_news(data)
    news_index = {nid: i for i, nid in enumerate(news["id"])}
    cat_codes, cats = pd.factorize(news["category"])
    emb = embed_news(news, data / "news_minilm.npy", device)
    log(f"news embeddings {emb.shape}")

    train_b = load_behaviors(data, "train")
    dev_b = load_behaviors(data, "dev")
    last_day = train_b["time"].dt.floor("D").max()
    fit_b = train_b[train_b["time"].dt.floor("D") < last_day].reset_index(drop=True)
    val_b = train_b[train_b["time"].dt.floor("D") == last_day].reset_index(drop=True)

    Hf, Mf = history_matrix(fit_b["history"], news_index)
    Hv, Mv = history_matrix(val_b["history"], news_index)
    Hd, Md = history_matrix(dev_b["history"], news_index)
    rows, pos, negs = training_samples(fit_b, news_index, rng)
    log(f"training clicks={len(rows):,} from {len(fit_b):,} impressions; validation impressions={len(val_b):,}")

    model = NRMS(torch.from_numpy(emb).to(device), torch.from_numpy(cat_codes).to(device), len(cats)).to(device)
    out = ROOT / "ml" / "results"
    if args.score_only:
        model.load_state_dict(torch.load(out / "nrms.pt", map_location=device))
        write_candidate_scores(model, train_b, dev_b, news_index, device, data)
        return
    opt = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=1e-4)
    best, best_state, history = -1.0, None, []
    for epoch in range(1, args.epochs + 1):
        model.train()
        perm = rng.permutation(len(rows))
        total = 0.0
        for s in range(0, len(perm), args.batch):
            i = perm[s:s + args.batch]
            hist = torch.from_numpy(Hf[rows[i]]).to(device)
            mask = torch.from_numpy(Mf[rows[i]]).to(device)
            cands = torch.from_numpy(np.concatenate([pos[i, None], negs[i]], axis=1)).to(device)
            loss = F.cross_entropy(model(hist, mask, cands), torch.zeros(len(i), dtype=torch.long, device=device))
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += loss.item() * len(i)
        g, y, s_ = score_impressions(model, val_b, Hv, Mv, news_index, device)
        val_auc = float(per_impression_metrics(g, y, s_)["auc"].mean())
        history.append({"epoch": epoch, "loss": round(total / len(perm), 4), "val_auc": round(val_auc * 100, 2)})
        log(f"epoch {epoch}: loss {total / len(perm):.4f}  validation AUC {val_auc * 100:.2f}")
        if val_auc > best:
            best, best_state = val_auc, {k: v.detach().clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    g, y, s_ = score_impressions(model, dev_b, Hd, Md, news_index, device)
    per = per_impression_metrics(g, y, s_)
    row = {"model": "Neural NRMS (GPU, MiniLM news encoder)", "impressions": int(len(per)), **summarise(per, rng)}
    log(f"DEV  AUC {row['auc']['mean']:.2f}  MRR {row['mrr']['mean']:.2f}  nDCG@5 {row['ndcg5']['mean']:.2f}  nDCG@10 {row['ndcg10']['mean']:.2f}")

    out.mkdir(parents=True, exist_ok=True)
    torch.save(best_state, out / "nrms.pt")
    neural = {"result": row, "training": history, "device": torch.cuda.get_device_name(0) if device == "cuda" else "cpu",
              "runtime_seconds": round(time.time() - t0), "clicks_trained_on": int(len(rows))}
    (out / "neural.json").write_text(json.dumps(neural, indent=1))
    for path in (out / "metrics.json",):
        if path.exists():
            report = json.loads(path.read_text())
            report["results"] = [r for r in report["results"] if not r["model"].startswith("Neural NRMS")] + [row]
            report["neural"] = {k: v for k, v in neural.items() if k != "result"}
            path.write_text(json.dumps(report, indent=1))
    write_candidate_scores(model, train_b, dev_b, news_index, device, data)
    log(f"done in {neural['runtime_seconds']}s")


if __name__ == "__main__":
    main()
