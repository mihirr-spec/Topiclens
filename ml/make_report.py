"""
Build the 3-page project report (docs/TopicLens_Report.html) from ml/results/metrics.json.
Print it to PDF with headless Chrome (A4, backgrounds on), e.g. via the scratch CDP script,
or open it in a browser and use Print -> Save as PDF.

    .venv/Scripts/python ml/make_report.py
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONTS = (ROOT / "node_modules").as_uri()

r = json.loads((ROOT / "ml" / "results" / "metrics.json").read_text())
neural = json.loads((ROOT / "ml" / "results" / "neural.json").read_text())
ds = r["dataset"]
rows = sorted(r["results"], key=lambda x: -x["auc"]["mean"])
best = rows[0]
lr = next(x for x in rows if x["model"] == "Logistic regression")
imp = r["lightgbm"]["importance"]
paper = r["paper_reference"]


def fmt(n: float) -> str:
    return f"{n:,.0f}"


def ci(x: dict, m: str) -> str:
    lo, hi = x[m]["ci95"]
    return f"{x[m]['mean']:.2f}<small>±{(hi - lo) / 2:.2f}</small>"


KIND = {
    "Hybrid: LightGBM + neural score": "Hybrid (stacked)",
    "Logistic regression": "Linear classifier",
    "LightGBM LambdaRank": "Gradient-boosted trees",
    "Linear SVM": "Support vector machine",
    "Neural NRMS (GPU, MiniLM news encoder)": "Neural network (GPU)",
    "Random forest": "Tree ensemble",
    "Kernel SVM (RBF, Nystroem)": "Support vector machine",
    "KNN classifier (k=50)": "Nearest neighbours",
}
table = "\n".join(
    f"<tr class='{'app' if x['model'] == 'Logistic regression' else ''}{' best' if x is best else ''}'>"
    f"<td>{x['model']}</td><td class='kind'>{KIND.get(x['model'], 'Rule (baseline)')}</td>"
    f"<td class='n'>{ci(x, 'auc')}</td><td class='n'>{ci(x, 'mrr')}</td><td class='n'>{ci(x, 'ndcg5')}</td><td class='n'>{ci(x, 'ndcg10')}</td></tr>"
    for x in rows
)
lo, hi = 48.0, max(paper["auc"], best["auc"]["mean"]) + 1
bar = lambda v: f"{(v - lo) / (hi - lo) * 100:.1f}%"
chart = "\n".join(
    f"<div class='bar {'app' if x['model'] == 'Logistic regression' else ''}'><span>{x['model'].split(' (')[0]}</span>"
    f"<i style='width:{bar(x['auc']['mean'])}'></i><b>{x['auc']['mean']:.1f}</b></div>"
    for x in rows
) + f"<div class='bar paper'><span>Paper's BATM-NR (reported)</span><i style='width:{bar(paper['auc'])}'></i><b>{paper['auc']:.1f}</b></div>"
importance = "".join(f"<li><b>{d['gain_share'] * 100:.0f}%</b> {d['label']}</li>" for d in imp[:6])

html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>TopicLens: project report</title>
<style>
@font-face {{ font-family: News; src: url("{FONTS}/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2") format("woff2"); font-weight: 200 800; }}
@font-face {{ font-family: News; font-style: italic; src: url("{FONTS}/@fontsource-variable/newsreader/files/newsreader-latin-opsz-italic.woff2") format("woff2"); font-weight: 200 800; }}
@font-face {{ font-family: Sans; src: url("{FONTS}/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2") format("woff2"); font-weight: 100 900; }}
@font-face {{ font-family: Mono; src: url("{FONTS}/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2") format("woff2"); }}
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; background: #f6f4ee; color: #141414; font-family: Sans, sans-serif; font-size: 9.6pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
.page {{ width: 210mm; height: 297mm; padding: 15mm 17mm 13mm; position: relative; page-break-after: always; overflow: hidden; display: flex; flex-direction: column; }}
.page:last-child {{ page-break-after: auto; }}
header.run {{ display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #c9c3b6; padding-bottom: 6px; margin-bottom: 12px; }}
.mark {{ font-family: News; font-weight: 600; font-size: 13pt; letter-spacing: -0.02em; }} .mark span {{ color: #1d4e8f; }}
.run small, footer small {{ font-family: Mono; font-size: 6.6pt; letter-spacing: 0.12em; text-transform: uppercase; color: #6f6b63; }}
footer {{ margin-top: auto; border-top: 1px solid #dcd7cc; padding-top: 5px; display: flex; justify-content: space-between; }}
.eyebrow {{ font-family: Mono; font-size: 6.8pt; letter-spacing: 0.16em; text-transform: uppercase; color: #1d4e8f; display: flex; align-items: center; gap: 10px; margin: 0 0 5px; }}
.eyebrow::after {{ content: ""; width: 50px; height: 1px; background: #c9c3b6; }}
h1 {{ font-family: News; font-weight: 500; font-size: 27pt; line-height: 1.02; letter-spacing: -0.02em; margin: 6px 0 8px; }}
h2 {{ font-family: News; font-weight: 500; font-size: 15pt; line-height: 1.1; letter-spacing: -0.01em; margin: 0 0 6px; }}
h3 {{ font-family: News; font-weight: 600; font-size: 10.5pt; margin: 0 0 3px; }}
em {{ color: #1d4e8f; font-style: italic; }}
p {{ margin: 0 0 6px; }}
.lede {{ font-family: News; font-size: 12pt; line-height: 1.38; color: #3d3b37; margin-bottom: 10px; }}
.serif {{ font-family: News; font-size: 10.6pt; line-height: 1.42; }}
section {{ margin-bottom: 10px; }}
.cols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }}
.cols3 {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }}
.card {{ background: #fbfaf6; border: 1px solid #dcd7cc; border-radius: 4px; padding: 9px 11px; }}
.num {{ font-family: Mono; font-size: 6.8pt; color: #1d4e8f; margin-bottom: 3px; }}
ul {{ margin: 3px 0 0; padding-left: 15px; }} li {{ margin: 1px 0; }}
.answer {{ border-left: 3px solid #1d4e8f; background: rgba(29,78,143,0.06); padding: 9px 12px; }}
.answer b {{ color: #1d4e8f; }}
.flow {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; margin: 6px 0 2px; }}
.flow div {{ border: 1px solid #c9c3b6; background: #fbfaf6; padding: 7px 8px; font-size: 8.1pt; position: relative; }}
.flow div + div {{ border-left: 0; }}
.flow div b {{ display: block; font-family: News; font-size: 9.6pt; margin-bottom: 2px; }}
.flow div.hi {{ background: rgba(29,78,143,0.07); border-color: #1d4e8f; }}
.stats {{ display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #c9c3b6; border-bottom: 1px solid #c9c3b6; margin: 4px 0 10px; }}
.stats div {{ padding: 8px 10px 8px 0; }} .stats div + div {{ padding-left: 10px; border-left: 1px solid #dcd7cc; }}
.stats b {{ font-family: News; font-weight: 500; font-size: 18pt; line-height: 1; display: block; letter-spacing: -0.01em; }}
.stats span {{ font-size: 7.6pt; color: #6f6b63; }}
table {{ width: 100%; border-collapse: collapse; font-size: 8.2pt; }}
th {{ font-family: Mono; font-weight: 400; font-size: 6.5pt; letter-spacing: 0.08em; text-transform: uppercase; color: #6f6b63; text-align: left; border-bottom: 1px solid #3d3b37; padding: 4px 5px; }}
td {{ padding: 2.5px 5px; border-bottom: 1px solid #e3ded3; vertical-align: top; }}
td.n, th.n {{ text-align: right; font-family: Mono; font-size: 7.6pt; white-space: nowrap; }}
td.n small {{ color: #8b867c; font-size: 6.2pt; margin-left: 2px; }}
td.kind {{ color: #6f6b63; font-size: 7.6pt; }}
tr.app td {{ background: rgba(29,78,143,0.07); }} tr.app td:first-child {{ color: #1d4e8f; font-weight: 600; }}
tr.best td:first-child {{ font-weight: 600; }}
.split {{ display: grid; grid-template-columns: 1.55fr 0.4fr 1fr; height: 30px; margin: 6px 0 3px; font-size: 7.6pt; }}
.split div {{ display: flex; align-items: center; justify-content: center; color: #fff; }}
.split .tr {{ background: #1d4e8f; }} .split .va {{ background: #5f82b4; }} .split .te {{ background: #141414; }}
.split-cap {{ display: grid; grid-template-columns: 1.55fr 0.4fr 1fr; font-size: 7.4pt; color: #3d3b37; }}
.split-cap span {{ padding-right: 8px; }}
.bars {{ display: grid; gap: 2.5px; }}
.bar {{ display: grid; grid-template-columns: 34% 1fr 30px; gap: 8px; align-items: center; font-size: 7.8pt; color: #3d3b37; }}
.bar i {{ display: block; height: 6px; background: #c9c3b6; }} .bar.app i {{ background: #1d4e8f; }} .bar.app span {{ color: #1d4e8f; font-weight: 600; }}
.bar.paper i {{ background: repeating-linear-gradient(90deg, #6a3f8f 0 4px, transparent 4px 7px); }} .bar.paper span {{ color: #6a3f8f; }}
.bar b {{ font-family: Mono; font-weight: 400; font-size: 7.4pt; text-align: right; }}
.small {{ font-size: 7.8pt; color: #6f6b63; }}
.imp {{ columns: 2; column-gap: 20px; margin-top: 2px; font-size: 8.4pt; }} .imp b {{ font-family: Mono; font-weight: 400; color: #1d4e8f; display: inline-block; min-width: 30px; }}
.feat td:first-child {{ font-weight: 600; white-space: nowrap; }}
</style></head><body>

<!-- PAGE 1 -->
<div class="page">
  <header class="run"><span class="mark">Topic<span>Lens</span></span><small>Project report · page 1 of 3</small></header>
  <p class="eyebrow">Explainable news recommendation</p>
  <h1>A news recommender trained on <em>real clicks</em>, that explains every pick.</h1>
  <p class="lede">TopicLens recommends the news articles each reader is most likely to want, learned from real Microsoft News click logs, and shows exactly why each article was recommended.</p>

  <section>
    <h2>1. What is it for?</h2>
    <p class="serif">News apps decide what people read, but their models are black boxes: readers cannot see why a story was chosen or correct a wrong guess. TopicLens is a university research project, built on Liu et al. (2024), <i>Topic-Centric Explanations for News Recommendation</i> (ACM TORS 3(2)). It aims to recommend accurately <b>and</b> transparently, so recommendations can be trusted and steered.</p>
    <div class="cols3" style="margin-top:6px">
      <div class="card"><div class="num">01</div><h3>Readers</h3>A feed ranked for them, with the reasons one tap away and controls to push back.</div>
      <div class="card"><div class="num">02</div><h3>Students &amp; researchers</h3>A complete, inspectable pipeline: real data, features, 14 models, standard metrics.</div>
      <div class="card"><div class="num">03</div><h3>Reviewers</h3>Every number is labelled as measured here, taken from the paper, or not yet evaluated.</div>
    </div>
  </section>

  <section>
    <h2>2. What does it do?</h2>
    <div class="cols">
      <div class="serif"><b>Ranks a personal feed</b> from four kinds of evidence:
        <ul>
          <li><b>Reading &amp; clicking history</b>: opening a story counts as a click and joins the history.</li>
          <li><b>Preferred sections</b> picked at sign-up and editable later.</li>
          <li><b>Interaction with earlier recommendations</b>: stories passed over above a click move down.</li>
          <li><b>Explicit feedback</b>: More / Less like this, Not interested, topic sliders and mutes.</li>
        </ul>
      </div>
      <div class="serif"><b>Explains each pick</b> on request: the score split into its signals (they add up exactly), the past reads behind it, and the words that matched.
        <p style="margin-top:6px"><b>Web app</b>: React + TypeScript, runs in the browser; sign in with Google, email, as a guest or as a real anonymised demo reader. <b>ML</b>: Python (scikit-learn, LightGBM, PyTorch + CUDA).</p>
      </div>
    </div>
  </section>

  <section>
    <h2>3. How does it recommend?</h2>
    <div class="flow">
      <div><b>Article text</b>Title + abstract of each article.</div>
      <div><b>Content vectors</b>30 NMF topics and a 100-d LSA text embedding.</div>
      <div><b>10 features</b>per reader × article: topic &amp; text match, section affinity, popularity, freshness…</div>
      <div class="hi"><b>Trained classifier</b>Logistic regression predicts P(click).</div>
      <div><b>Ranked feed</b>Sorted by P(click), adjusted by the reader's feedback.</div>
    </div>
    <p class="small">The reader profile is the average of their last 50 reads, exactly as during training.</p>
    <div class="answer serif" style="margin-top:8px">
      <b>Does it use KNN or SVM?</b> Not in the app. We trained and tested <b>KNN, a linear SVM, a kernel (RBF) SVM, a random forest, LightGBM, logistic regression, a neural network (NRMS, on a GPU) and a hybrid</b> on the same data. The app ranks with <b>logistic regression</b> (AUC {lr['auc']['mean']:.2f}): it ties for best of the single models (LightGBM {next(x for x in rows if x['model']=='LightGBM LambdaRank')['auc']['mean']:.2f}, linear SVM {next(x for x in rows if x['model']=='Linear SVM')['auc']['mean']:.2f}) and its score splits exactly into per-signal reasons. KNN scored lowest of the trained models (AUC {next(x for x in rows if x['model'].startswith('KNN'))['auc']['mean']:.2f}). The most accurate model overall is the <b>hybrid</b> (AUC {best['auc']['mean']:.2f}), reported but not run in the browser because it needs the neural network.
    </div>
  </section>
  <footer><small>TopicLens · github.com/mihirr-spec/Topiclens</small><small>Data: MIND-small (Wu et al., ACL 2020)</small></footer>
</div>

<!-- PAGE 2 -->
<div class="page">
  <header class="run"><span class="mark">Topic<span>Lens</span></span><small>Project report · page 2 of 3</small></header>
  <p class="eyebrow">Data</p>
  <h2 style="font-size:20pt">4. The dataset: <em>MIND-small</em></h2>
  <p class="serif">MIND, the Microsoft News Dataset (Wu et al., ACL 2020), contains real, anonymised logs from Microsoft News: for each visit ("impression"), the articles a user was shown and which ones they clicked, plus that user's earlier click history. It is the benchmark used by the paper this project builds on. License: Microsoft Research License (non-commercial research). We verified our copy against Microsoft's published row counts (156,965 / 73,152 impressions; 51,282 / 42,416 articles).</p>
  <div class="stats">
    <div><b>{fmt(ds['news'])}</b><span>news articles (title, abstract, category, sub-category)</span></div>
    <div><b>{fmt(ds['users'])}</b><span>anonymised users</span></div>
    <div><b>{fmt(ds['train_impressions'] + ds['dev_impressions'])}</b><span>impressions with clicks</span></div>
    <div><b>{ds['candidate_rows'] / 1e6:.2f}M</b><span>articles shown; {ds['click_rate'] * 100:.2f}% clicked</span></div>
  </div>

  <section>
    <h2>5. Train / test split</h2>
    <p class="serif">The split is by <b>time</b>, so the model is always tested on the future, as it would be in use. MIND's own test labels are not public, so the official dev set is our test set.</p>
    <div class="split"><div class="tr">Training · 9–13 Nov 2019</div><div class="va">Validation · 14 Nov</div><div class="te">Test · 15 Nov 2019</div></div>
    <div class="split-cap"><span>{fmt(ds['fit_impressions'])} impressions · 4.62M candidate rows</span><span>{fmt(ds['validation_impressions'])} impr.<br>1.22M rows</span><span>{fmt(ds['dev_impressions'])} impressions · 2.74M rows (never seen)</span></div>
    <ul class="serif" style="margin-top:8px">
      <li><b>Training</b>: fits every model. <b>Validation</b> (last training day): early stopping and model selection only.</li>
      <li><b>Test</b>: used once, to report every number on page 3.</li>
      <li>The hybrid is trained on the validation day, which the neural network never saw, so its neural-score input is an honest out-of-sample prediction.</li>
      <li>Heavy models were fitted on random samples of the training rows (KNN 60k, kernel SVM 150k, linear SVM and random forest 400k), then scored on all 2.74M test rows.</li>
    </ul>
  </section>

  <section>
    <h2>6. Features (no label leakage)</h2>
    <table class="feat">
      <tr><th>Feature</th><th>What it measures</th></tr>
      <tr><td>Topic match</td><td>Dot product of the user's mean NMF topic vector (last 50 reads) and the article's topics (30 topics from TF-IDF).</td></tr>
      <tr><td>Text similarity</td><td>Cosine between the user's mean LSA embedding (100-d) and the article's.</td></tr>
      <tr><td>Section / sub-section affinity</td><td>Share of the user's reads in the article's category and sub-category.</td></tr>
      <tr><td>Earlier-day clicks &amp; CTR</td><td>Clicks and smoothed click-through rate from <b>strictly earlier days</b> of the training log only.</td></tr>
      <tr><td>Prior exposure, freshness</td><td>Times shown before this moment; hours since first appearance (from timestamps, never labels).</td></tr>
      <tr><td>History length, impression size</td><td>How much the user has read; how many articles were shown together.</td></tr>
    </table>
    <h3 style="margin-top:9px">Which features matter most (LightGBM, share of split gain)</h3>
    <ul class="imp">{importance}</ul>
    <p class="small" style="margin-top:5px">The neural model (NRMS-style) learns from text instead: a MiniLM sentence encoder for articles and self-attention over the user's last 50 reads, trained on {fmt(neural['clicks_trained_on'])} clicks with 4 sampled negatives each, {len(neural['training'])} epochs on an RTX 3050 ({neural['runtime_seconds'] // 60} min).</p>
  </section>
  <footer><small>TopicLens · github.com/mihirr-spec/Topiclens</small><small>Split by date: train → validation → test</small></footer>
</div>

<!-- PAGE 3 -->
<div class="page">
  <header class="run"><span class="mark">Topic<span>Lens</span></span><small>Project report · page 3 of 3</small></header>
  <p class="eyebrow">Results</p>
  <h2 style="font-size:20pt">7. Performance on <em>{fmt(ds['dev_impressions'])} test visits</em></h2>
  <p class="serif">Metrics follow MIND's definitions, computed per visit and averaged; ± is the 95% confidence interval from 500 bootstrap resamples. Highlighted: the model the app uses.</p>
  <table>
    <tr><th>Model</th><th>Type</th><th class="n">AUC</th><th class="n">MRR</th><th class="n">nDCG@5</th><th class="n">nDCG@10</th></tr>
    {table}
    <tr><td style="color:#6a3f8f">Paper's BATM-NR (from its Table 5)</td><td class="kind">Neural, reads full text</td><td class="n">{paper['auc']:.2f}</td><td class="n">{paper['mrr']:.2f}</td><td class="n">{paper['ndcg5']:.2f}</td><td class="n">{paper['ndcg10']:.2f}</td></tr>
  </table>

  <div class="cols" style="margin-top:12px">
    <section>
      <h3>AUC by model (50 = random)</h3>
      <div class="bars">{chart}</div>
    </section>
    <section>
      <h3>What the metrics mean</h3>
      <ul style="margin-top:0">
        <li><b>AUC</b>: chance that a clicked article ranks above an unclicked one.</li>
        <li><b>MRR</b>: how high the first click sits (1/rank, averaged).</li>
        <li><b>nDCG@k</b>: how much of the clicked content lands in the top k.</li>
      </ul>
      <div class="answer" style="margin-top:7px"><b>Why not plain "accuracy"?</b> Only {ds['click_rate'] * 100:.1f}% of shown articles are clicked, so predicting "no click" for everything is {100 - ds['click_rate'] * 100:.1f}% accurate yet useless. Recommenders are judged on ranking, hence AUC/MRR/nDCG.</div>
    </section>
  </div>

  <section style="margin-top:6px">
    <h3>Findings</h3>
    <ul class="serif">
      <li>Trained models clearly beat simple rules: best single model {lr['auc']['mean']:.1f} vs {next(x for x in rows if x['model'].startswith('Category'))['auc']['mean']:.1f} for the best rule (category match) and 50 for random.</li>
      <li>The <b>hybrid</b> (LightGBM + neural score) is best at <b>AUC {best['auc']['mean']:.2f}</b>, {paper['auc'] - best['auc']['mean']:.1f} points below the paper's model, which reads full article bodies.</li>
      <li>Topic match alone ({next(x for x in rows if x['model'].startswith('Topic'))['auc']['mean']:.1f}) barely beats random: topics help as one learned signal, not as the whole ranker.</li>
      <li><b>Limits</b>: offline evaluation on 2019 logs; titles and abstracts only; whether explanations improve trust needs a user study.</li>
    </ul>
  </section>
  <footer><small>TopicLens · github.com/mihirr-spec/Topiclens</small><small>All numbers from ml/results/metrics.json</small></footer>
</div>
</body></html>"""

out = ROOT / "docs" / "TopicLens_Report.html"
out.write_text(html, encoding="utf-8")
print(f"wrote {out}")
