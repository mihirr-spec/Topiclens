import { Evidence } from "../components/shared";
import { IMPORTANCE, META, MODEL, PAPER, RESULTS, type ResultRow } from "../data/mind";
import { SIGNAL_NAME } from "../engine/explain";

/** Table 5 of Liu et al. (2024), MIND-small, transcribed from the paper. Percentages. */
const PAPER_TABLE5: { model: string; small: number[] }[] = [
  { model: "LSTUR", small: [67.26, 31.44, 35.2, 41.43] },
  { model: "NAML", small: [67.14, 31.58, 35.2, 41.52] },
  { model: "NPA", small: [66.24, 31.06, 34.37, 40.69] },
  { model: "NRMS", small: [66.58, 31.44, 34.99, 41.21] },
  { model: "DKN", small: [66.95, 31.12, 34.94, 41.13] },
  { model: "BATM-NR (paper)", small: [68.13, 32.62, 36.36, 42.46] },
];

const METRICS = [
  { key: "auc", label: "AUC", help: "How often a clicked story ranks above an unclicked one. 50 = coin flip." },
  { key: "mrr", label: "MRR", help: "How high the first clicked story sits, on average." },
  { key: "ndcg5", label: "nDCG@5", help: "How much of the good stuff lands in the top 5." },
  { key: "ndcg10", label: "nDCG@10", help: "The same for the top 10." },
] as const;

const fmt = (n: number) => n.toLocaleString("en-US");

export function ResultsPage() {
  const rows = [...RESULTS].sort((a, b) => a.auc.mean - b.auc.mean);
  const lo = 48, hi = Math.max(PAPER.auc, ...rows.map((r) => r.auc.mean)) + 1;
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const weights = MODEL.features
    .map((f, j) => ({ f, w: MODEL.coef[j] }))
    .filter((d) => d.f !== "impression_size")
    .sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
  const maxW = Math.max(...weights.map((d) => Math.abs(d.w)));

  return (
    <>
      <div className="page-head">
        <h1>How well does it work?</h1>
        <p>
          Every model was trained on {fmt(META.train_impressions)} real Microsoft News visits (9 to 14 Nov 2019) and tested on{" "}
          {fmt(META.dev_impressions)} visits from the next day that it never saw. Scores are averaged per visit, with 95%
          confidence intervals from 500 bootstrap resamples. <Evidence kind="computed">Measured</Evidence>
        </p>
      </div>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2>AUC on unseen visits</h2>
        <p className="small muted">Whiskers show the 95% confidence interval. The dashed line is the paper's neural model, from its own paper.</p>
        <div className="auc-chart" role="img" aria-label="AUC by model">
          {rows.map((r) => (
            <div key={r.model} className={`auc-row ${r.model === "Logistic regression" ? "is-app" : ""}`}>
              <span className="auc-name">{r.model}{r.model === "Logistic regression" && <span className="badge new" style={{ marginLeft: 6 }}>powers the app</span>}</span>
              <span className="auc-track">
                <span className="auc-bar" style={{ width: x(r.auc.mean) }} />
                <span className="auc-ci" style={{ left: x(r.auc.ci95[0]), width: `calc(${x(r.auc.ci95[1])} - ${x(r.auc.ci95[0])})` }} />
                <span className="auc-paper" style={{ left: x(PAPER.auc) }} />
              </span>
              <span className="num">{r.auc.mean.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2>All metrics</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Model</th>{METRICS.map((m) => <th key={m.key} className="num" title={m.help}>{m.label}</th>)}</tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r: ResultRow) => (
                <tr key={r.model}>
                  <td>{r.model}</td>
                  {METRICS.map((m) => (
                    <td key={m.key} className="num">{r[m.key].mean.toFixed(2)} <span className="muted small">±{((r[m.key].ci95[1] - r[m.key].ci95[0]) / 2).toFixed(2)}</span></td>
                  ))}
                </tr>
              ))}
              <tr className="paper-row">
                <td>Paper's BATM-NR <span className="badge paper">from the paper</span></td>
                <td className="num">{PAPER.auc.toFixed(2)}</td><td className="num">{PAPER.mrr.toFixed(2)}</td>
                <td className="num">{PAPER.ndcg5.toFixed(2)}</td><td className="num">{PAPER.ndcg10.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="small muted" style={{ marginTop: 10 }}>
          {METRICS.map((m) => <li key={m.key}><b>{m.label}:</b> {m.help}</li>)}
        </ul>
      </section>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <section className="card">
          <h2>What the tree model relies on</h2>
          <p className="small muted">LightGBM's share of total split gain per signal.</p>
          {IMPORTANCE.map((d) => (
            <div key={d.feature} className="signal pos">
              <span className="signal-label">{SIGNAL_NAME[d.feature] ?? d.label}</span>
              <span className="signal-track" aria-hidden="true"><span className="signal-fill" style={{ width: `${(d.gain_share / IMPORTANCE[0].gain_share) * 100}%` }} /></span>
              <span className="num">{Math.round(d.gain_share * 100)}%</span>
            </div>
          ))}
        </section>
        <section className="card">
          <h2>The app's model, weight by weight</h2>
          <p className="small muted">Logistic-regression weights on standardised signals. Red lowers the click chance.</p>
          {weights.map((d) => (
            <div key={d.f} className={`signal ${d.w < 0 ? "neg" : "pos"}`}>
              <span className="signal-label">{SIGNAL_NAME[d.f]}</span>
              <span className="signal-track" aria-hidden="true"><span className="signal-fill" style={{ width: `${(Math.abs(d.w) / maxW) * 100}%` }} /></span>
              <span className="num">{d.w > 0 ? "+" : "−"}{Math.abs(d.w).toFixed(3)}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="section-title"><h2>The paper's own results (MIND-small)</h2><Evidence kind="paper">Liu et al. 2024, Table 5</Evidence></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Model</th>{METRICS.map((m) => <th key={m.key} className="num">{m.label}</th>)}</tr></thead>
            <tbody>
              {PAPER_TABLE5.map((r) => (
                <tr key={r.model} style={r.model.startsWith("BATM") ? { fontWeight: 600 } : undefined}>
                  <td>{r.model}</td>{r.small.map((v, i) => <td key={i} className="num">{v.toFixed(2)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Not directly comparable: the paper's models read the full article body and train on its own split; ours read
          titles and abstracts and train on MIND-small train, tested on MIND-small dev.
        </p>
      </section>

      <section className="card">
        <div className="section-title"><h2>Not measured yet</h2><span className="badge sample">Not yet evaluated</span></div>
        <p className="small">
          Whether the explanations and controls help people is a design hypothesis. It needs a user study (comprehension,
          perceived control, time to a satisfying list, workload), with ethics approval, before it can be claimed.
        </p>
      </section>
    </>
  );
}
