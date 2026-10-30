"""
Export what the browser app needs from MIND and the trained model.

    .venv/Scripts/python ml/build_app_data.py [--pool 1500] [--showcase 24]

Run after ml/train.py (it reuses the cached topic/LSA vectors and the logistic
regression in ml/results/logreg.json). Writes:

  src/data/mind-app.json   articles (dev-day pool + persona histories) with their
                           topic vector, quantised LSA embedding and popularity
                           snapshot; real MIND readers as demo personas; the
                           logistic-regression model; topic words; metrics.
  public/showcase/*.jpg    Wikimedia Commons photos of entities named in real
                           MIND headlines, for the landing-page mosaic, with
                           author/licence credits in mind-app.json.

The app ranks with the logistic regression because its score splits exactly into
per-feature contributions (score = intercept + sum w_j * z_j), which is what the
"Why am I seeing this?" panel shows.
"""
from __future__ import annotations

import argparse
import base64
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

from train import FEATURE_TEXT, FEATURES, MAX_HISTORY, ROOT, content_vectors, load_behaviors, load_news, log

UA = {"User-Agent": "TopicLens/0.1 (university research prototype; https://doi.org/10.1145/3680295)"}
SKIP_CATEGORIES = {"video", "kids", "middleeast", "games"}
PERSONAS = [
    {"key": "U-LEO", "name": "Leo", "want": ["sports"], "description": "Follows sports closely, with some news."},
    {"key": "U-MIRA", "name": "Mira", "want": ["finance", "news"], "description": "Reads money and current-affairs stories."},
    {"key": "U-ASHA", "name": "Asha", "want": ["lifestyle", "foodanddrink", "travel", "health"], "description": "Into food, travel, health and lifestyle."},
]


def get_json(url: str, params: dict) -> dict:
    req = urllib.request.Request(f"{url}?{urllib.parse.urlencode(params)}", headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def b64(a: np.ndarray) -> str:
    return base64.b64encode(a.tobytes()).decode("ascii")


# Human names for the 30 NMF topics, written after reading each topic's top words (as the paper does).
# They match the K=30, seed-7 fit cached by ml/train.py; refit the topics and these must be re-read.
TOPIC_NAMES = ["NBA & basketball", "Police & shootings", "Trump & foreign policy", "Weather forecasts", "Apartment rentals", "Life tips & how-tos", "Schools & students", "World Series baseball", "Missing persons & families", "Local news roundups", "New York & New Jersey", "NFL weekly picks", "College towns & states", "Car crashes", "Sports awards & dates", "City councils & mayors", "Best-of lists & local spots", "Impeachment inquiry", "NFL trades & teams", "Patriots & Ravens", "Veterans Day", "Game day", "Storms & cold snaps", "Steelers & Browns", "2020 election", "Crime & arrests", "Pets, homes & adoption", "College football", "Real estate & listings", "NFL injuries"]


def topic_label(words: list[str], k: int) -> str:
    return TOPIC_NAMES[k] if k < len(TOPIC_NAMES) else " · ".join(w.capitalize() for w in words[:3])


def pick_personas(dev: pd.DataFrame, news: pd.DataFrame) -> list[dict]:
    cat_of = dict(zip(news["id"], news["category"]))
    users = dev.drop_duplicates("user").copy()
    users["hist"] = users["history"].str.split()
    users = users[users["hist"].str.len().between(25, 60)]
    chosen, used = [], set()
    for p in PERSONAS:
        share = users["hist"].map(lambda h: sum(cat_of.get(x) in p["want"] for x in h) / len(h))
        best = share[~users["user"].isin(used)].sort_values(ascending=False, kind="stable").index[0]
        u = users.loc[best]
        used.add(u["user"])
        cats = pd.Series([cat_of.get(x) for x in u["hist"]]).value_counts()
        chosen.append({
            "id": p["key"], "name": p["name"], "description": p["description"], "mindUser": u["user"],
            "interests": [c for c in cats.index[:3]], "historyIds": u["hist"][-MAX_HISTORY:],
        })
    return chosen


def wikimedia_images(entity_ids: list[str]) -> dict[str, dict]:
    """Wikidata P18 image per entity -> Commons thumbnail URL + author + licence."""
    files: dict[str, str] = {}
    for i in range(0, len(entity_ids), 50):
        data = get_json("https://www.wikidata.org/w/api.php", {
            "action": "wbgetentities", "ids": "|".join(entity_ids[i:i + 50]), "props": "claims", "format": "json"})
        for qid, ent in data.get("entities", {}).items():
            claims = ent.get("claims", {}).get("P18")
            if claims:
                files[qid] = claims[0]["mainsnak"]["datavalue"]["value"]
        time.sleep(0.2)
    out: dict[str, dict] = {}
    titles = {f"File:{f}": qid for qid, f in files.items()}
    names = list(titles)
    for i in range(0, len(names), 40):
        data = get_json("https://commons.wikimedia.org/w/api.php", {
            "action": "query", "titles": "|".join(names[i:i + 40]), "prop": "imageinfo",
            "iiprop": "url|extmetadata", "iiurlwidth": 640, "format": "json"})
        norm = {n["to"]: n["from"] for n in data["query"].get("normalized", [])}
        for page in data["query"]["pages"].values():
            info = (page.get("imageinfo") or [None])[0]
            if not info or "thumburl" not in info:
                continue
            meta = info.get("extmetadata", {})
            strip = lambda k: pd.Series([meta.get(k, {}).get("value", "")]).str.replace(r"<[^>]+>", "", regex=True).iloc[0].strip()
            qid = titles.get(norm.get(page["title"], page["title"]))
            if qid:
                out[qid] = {"thumb": info["thumburl"], "page": info["descriptionurl"], "author": strip("Artist")[:120], "license": strip("LicenseShortName")}
        time.sleep(0.2)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(ROOT / ".dataset-cache"))
    ap.add_argument("--pool", type=int, default=1500)
    ap.add_argument("--showcase", type=int, default=24)
    args = ap.parse_args()
    data = Path(args.data)
    rng = np.random.default_rng(7)

    news = load_news(data)
    idx = {nid: i for i, nid in enumerate(news["id"])}
    W, E, topic_words = content_vectors(news, data)
    train = load_behaviors(data, "train")
    dev = load_behaviors(data, "dev")
    beh = pd.concat([train, dev], ignore_index=True)

    # Popularity snapshot as of the end of the logs (the app's "now").
    items = beh[["time", "impressions"]].assign(item=beh["impressions"].str.split(" ")).explode("item")
    items["news"] = items["item"].str[:-2]
    items["label"] = items["item"].str[-1].astype(int)
    now = beh["time"].max()
    stats = items.groupby("news").agg(clicks=("label", "sum"), shows=("label", "size"), first=("time", "min"))
    global_ctr = items.loc[items.index.isin(train.index), "label"].mean()
    dev_shows = items.loc[items.index >= len(train)].groupby("news").size()

    # Article pool: the most-shown articles of the dev day (what readers were actually offered).
    pool = news[news["id"].isin(dev_shows.index) & ~news["category"].isin(SKIP_CATEGORIES) & (news["abstract"].str.len() > 40)]
    pool = pool.assign(shows=pool["id"].map(dev_shows)).sort_values("shows", ascending=False, kind="stable").head(args.pool)
    personas = pick_personas(dev, news)
    hist_ids = {h for p in personas for h in p["historyIds"]}
    keep = news[news["id"].isin(set(pool["id"]) | hist_ids)]
    log(f"pool={len(pool)} articles, persona history articles={len(hist_ids)}, exported={len(keep)}")

    # Photos: Wikidata images of entities named in titles, for the exported articles.
    ents: dict[str, str] = {}
    for nid, raw in zip(keep["id"], keep["title_entities"].fillna("[]")):
        for e in json.loads(raw):
            if e.get("WikidataId") and e.get("Confidence", 0) >= 0.9:
                ents[nid] = e["WikidataId"]
                break
    images = wikimedia_images(sorted(set(ents.values())))
    log(f"photos found for {sum(ents[n] in images for n in ents)} of {len(keep)} articles")

    articles = []
    for _, a in keep.iterrows():
        i = idx[a["id"]]
        st = stats.loc[a["id"]] if a["id"] in stats.index else None
        clicks, shows = (float(st["clicks"]), float(st["shows"])) if st is not None else (0.0, 0.0)
        hours = (now - st["first"]).total_seconds() / 3600 if st is not None else 0.0
        img = images.get(ents.get(a["id"], ""))
        articles.append({
            "id": a["id"], "category": a["category"], "subcategory": a["subcategory"], "title": a["title"], "abstract": a["abstract"],
            "url": a["url"], "inPool": bool(a["id"] in set(pool["id"])),
            "topics": b64((W[i] * 255).round().clip(0, 255).astype(np.uint8)),
            "emb": b64((E[i] * 127).round().clip(-127, 127).astype(np.int8)),
            "pop": {"prior_clicks": round(float(np.log1p(clicks)), 4), "prior_ctr": round((clicks + 10 * global_ctr) / (shows + 10), 5),
                    "exposure_before": round(float(np.log1p(shows)), 4), "hours_since_first_seen": round(float(np.log1p(max(hours, 0))), 4)},
            **({"image": {"src": img["thumb"], "page": img["page"], "author": img["author"], "license": img["license"]}} if img else {}),
        })

    # Showcase: distinct entities across categories, downloaded locally for a reliable hero.
    show_dir = ROOT / "public" / "showcase"
    show_dir.mkdir(parents=True, exist_ok=True)
    showcase, seen_ent = [], set()
    cands = [a for a in articles if a["inPool"] and "image" in a]
    rng.shuffle(cands)
    cands.sort(key=lambda a: a["category"])
    by_cat: dict[str, list] = {}
    for a in cands:
        by_cat.setdefault(a["category"], []).append(a)
    while len(showcase) < args.showcase and any(by_cat.values()):
        for cat in list(by_cat):
            if not by_cat[cat] or len(showcase) >= args.showcase:
                continue
            a = by_cat[cat].pop()
            if ents[a["id"]] in seen_ent:
                continue
            req = urllib.request.Request(a["image"]["src"], headers=UA)
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    (show_dir / f"{a['id']}.jpg").write_bytes(r.read())
            except Exception as e:  # a missing photo just leaves that headline out of the mosaic
                log(f"skip {a['id']}: {e}")
                continue
            seen_ent.add(ents[a["id"]])
            showcase.append({"id": a["id"], "src": f"showcase/{a['id']}.jpg", "title": a["title"], "category": a["category"], "credit": a["image"]})
            time.sleep(0.3)
    log(f"showcase photos downloaded: {len(showcase)}")

    lr = json.loads((ROOT / "ml" / "results" / "logreg.json").read_text())
    report = json.loads((ROOT / "ml" / "results" / "metrics.json").read_text())
    out = {
        "meta": {**report["dataset"], "now": now.isoformat(), "poolSize": int(len(pool)), "embScale": 127, "topicScale": 255},
        "results": report["results"],
        "paper": report["paper_reference"],
        "importance": report["lightgbm"]["importance"],
        "model": {"name": "Logistic regression", "features": FEATURES, "labels": [FEATURE_TEXT[f] for f in FEATURES],
                  "mean": lr["mean"], "scale": lr["scale"], "coef": lr["coef"], "intercept": lr["intercept"]},
        "topics": [{"index": k, "label": topic_label(w, k), "words": w} for k, w in enumerate(topic_words)],
        "categories": sorted(pool["category"].unique().tolist()),
        "personas": personas,
        "articles": articles,
        "showcase": showcase,
    }
    target = ROOT / "src" / "data" / "mind-app.json"
    target.write_text(json.dumps(out, separators=(",", ":")))
    log(f"wrote {target} ({target.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
