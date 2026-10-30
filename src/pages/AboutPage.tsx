import { Evidence } from "../components/shared";

export function AboutPage() {
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <h1>About the research</h1>
        <p>
          TopicLens is a university mini-project prototype. It builds on a published method and adds an interactive
          layer. This page sets out which parts come from the paper and which are new.
        </p>
      </div>

      <section className="card">
        <h2>Original paper <Evidence kind="paper" /></h2>
        <p>
          Dairui Liu, Derek Greene, Irene Li, Xuefei Jiang, and Ruihai Dong. 2024. <b>Topic-Centric Explanations for News
          Recommendation.</b> <i>ACM Transactions on Recommender Systems</i> 3, 2, Article 17 (November 2024), 25 pages.{" "}
          <a href="https://doi.org/10.1145/3680295" target="_blank" rel="noreferrer">https://doi.org/10.1145/3680295</a>
        </p>
        <p className="small muted">
          Licensed CC BY 4.0. The authors' code is linked from the paper (github.com/Ruixinhua/ExplainedNRS); it was
          not used or inspected for this prototype.
        </p>
      </section>

      <section className="card">
        <h2>Research-to-prototype mapping</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr><th>Problem the paper addresses</th><td>Neural news recommenders (NRMS, NAML, LSTUR…) rank well but are black boxes; their latent user/news embeddings don't say why an article was recommended, which can undermine trust.</td></tr>
              <tr><th>Existing approaches & limits</th><td>Attention weights over words (e.g. NPA) tend to highlight a single dominant interest and are rarely evaluated quantitatively; category labels are too coarse (“Travel” hides many sub-topics).</td></tr>
              <tr><th>Paper's contribution</th><td>BATM-NR: a news encoder with K word-level attention heads read as topics (topic-term weights), an additive topic→document layer (document-topic weights β), and an additive user encoder (user-news weights γ), with dot-product click prediction and NCE loss. An entropy regulariser sharpens topics. Explanations are matched topics between history and candidates; topic quality is measured with NPMI and W2V coherence. On MIND it outperforms the baselines it compares against (Table 5).</td></tr>
              <tr><th>Inherited by TopicLens</th><td>The explanation structure: document-topic weights, user profile = γ-weighted sum of history article vectors, dot-product score, history articles ranked by contribution, per-topic word highlighting (cf. Fig. 3, Fig. 8); NPMI coherence (Eq. 17); MIND ranking metrics.</td></tr>
              <tr><th>New in TopicLens <Evidence kind="new" /></th><td>(1) Explanations that are an exact decomposition of the score; (2) Topic Explorer: user-adjustable topic weights and mutes; (3) feedback loop (More/Less like this, Not interested) with a computed change log; (4) side-by-side baseline comparison; (5) explicit evidence labels and limitations in the interface.</td></tr>
              <tr><th>Why the extension may help</th><td>The paper's future work calls for a user study and for considering explanation cognitive load. Letting users act on an explanation (not just read it) may improve perceived control and transparency. This is a hypothesis.</td></tr>
              <tr><th>Supported by the paper</th><td>BATM-NR's accuracy on MIND (Table 5); its topics' coherence (Fig. 7); a recommendation/coherence trade-off across K and λ.</td></tr>
              <tr><th>Design hypotheses (untested)</th><td>That TopicLens's explanations are understandable; that controls increase trust or satisfaction; that the simplified scorer ranks well. See the Evaluation page for the study plan.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          TopicLens does not claim to invent explainable recommendation, topic modelling or topic-based explanations.
        </p>
      </section>

      <section className="card">
        <h2>Paper vs baseline vs TopicLens</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Aspect</th><th>Published paper (BATM-NR)</th><th>Simple rules (this project)</th><th>TopicLens (this project)</th></tr></thead>
            <tbody>
              <tr><td>Data</td><td>MIND-small & MIND-large, title + body text</td><td colSpan={2}>MIND-small: 65,238 articles (title + abstract), 156,965 training visits, 73,152 test visits; demo readers are real anonymised MIND users</td></tr>
              <tr><td>Topic discovery</td><td>K attention heads in a neural encoder, trained on clicks; GloVe init; entropy regularisation</td><td>NMF topics, used directly as a score</td><td>NMF on TF-IDF (K = 30), one of ten signals the model learns to weigh</td></tr>
              <tr><td>News representation</td><td>d = Σ β_k h_k (300-d)</td><td>Topic or popularity only</td><td>Topic proportions + 100-d LSA embedding + popularity and freshness</td></tr>
              <tr><td>User representation</td><td>Learned additive attention γ over history (or GRU)</td><td>Mean topic vector of history</td><td>Mean topic vector, mean embedding and section shares of the last 50 reads, then user controls & feedback</td></tr>
              <tr><td>Score</td><td>uᵀd, trained with NCE loss</td><td>Dot product or click rate</td><td>Logistic regression trained on real clicks (also trained: LightGBM, a GPU neural NRMS and a hybrid)</td></tr>
              <tr><td>Explanation</td><td>Attention weights: γ for history, β for topics, α for words</td><td>None</td><td>Exact split of the score into ten signals, plus the past reads behind it and matched words</td></tr>
              <tr><td>User control</td><td>None</td><td>None</td><td>Topic sliders, mute, More/Less like this, Not interested</td></tr>
              <tr><td>Evaluation</td><td>AUC/MRR/nDCG on MIND; NPMI & W2V coherence; case studies</td><td colSpan={2}>AUC/MRR/nDCG on 73,152 unseen MIND visits with 95% CIs (see Results). User study: not yet evaluated</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Architecture</h2>
        <ArchitectureDiagram />
        <p className="small muted">Everything runs client-side in the browser. Orange boxes are TopicLens additions.</p>
      </section>

      <section className="card">
        <h2>Limitations & future work</h2>
        <ul className="small">
          <li>Not a reproduction of BATM: no neural encoder, no click training, no entropy regularisation, no word embeddings.</li>
          <li>Titles and abstracts only (no article body), so text signals are weaker than the paper's; the best model here scores about 4 AUC points below the paper's.</li>
          <li>Popularity is a snapshot of one week in November 2019; accounts live only in this browser (no server).</li>
          <li>Accuracy is measured offline on logged clicks; whether the explanations help people still needs a user study.</li>
          <li>Recency weights γ are fixed rather than learned; feedback strength and mute threshold are hand-set.</li>
          <li>Future work: train BATM on MIND (e.g. with the authors' code) and plug its β/γ/α into the same interface; run the planned user study; measure explanation workload.</li>
        </ul>
      </section>
    </div>
  );
}

function ArchitectureDiagram() {
  const box = (x: number, y: number, w: number, label: string[], isNew = false) => (
    <g>
      <rect x={x} y={y} width={w} height={22 + label.length * 16} rx={8} className={isNew ? "box-new" : "box"} />
      {label.map((l, i) => (
        <text key={i} x={x + w / 2} y={y + 22 + i * 16} textAnchor="middle" fontSize={i === 0 ? 13 : 11} fontWeight={i === 0 ? 600 : 400}>{l}</text>
      ))}
    </g>
  );
  return (
    <svg viewBox="0 0 900 300" className="diagram" role="img" aria-label="TopicLens architecture: real news data feeds a topic model; a user profile built from history and controls scores candidates; explanations and the UI feed feedback back into the profile.">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="currentColor" style={{ color: "var(--text-3)" }} />
        </marker>
      </defs>
      {box(10, 20, 160, ["News articles", "headline + summary"])}
      {box(10, 130, 160, ["Reading history", "your account"])}
      {box(220, 20, 180, ["Article signals", "NMF topics (K=30), LSA", "popularity, freshness"])}
      {box(220, 130, 180, ["User profile", "mean of last 50 reads", "+ feedback, × multipliers"])}
      {box(450, 75, 170, ["Trained model", "logistic regression", "on MIND clicks"])}
      {box(670, 20, 210, ["Explainer", "topic & history decomposition", "word highlights"])}
      {box(670, 140, 210, ["TopicLens UI", "feed · explorer · compare", "evaluation"], true)}
      {box(220, 235, 180, ["Controls & feedback", "sliders, mute, more/less"], true)}
      {box(450, 200, 170, ["Simple rules", "popularity, topic match"])}
      <path className="arrow" d="M170,45 L220,45" />
      <path className="arrow" d="M170,155 L220,155" />
      <path className="arrow" d="M310,85 L310,130" />
      <path className="arrow" d="M400,160 L450,115" />
      <path className="arrow" d="M400,60 L450,95" />
      <path className="arrow" d="M620,100 L670,60" />
      <path className="arrow" d="M775,95 L775,140" />
      <path className="arrow" d="M670,200 L400,255" />
      <path className="arrow" d="M310,235 L310,190" />
      <path className="arrow" d="M620,225 L670,190" />
    </svg>
  );
}
