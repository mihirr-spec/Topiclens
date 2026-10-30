import { useMemo, useState } from "react";
import { Evidence, TopicChip } from "../components/shared";
import { useLens } from "../context";
import { ARTICLE_BY_ID, RESULTS } from "../data/mind";
import { shortExplanation } from "../engine/explain";
import { baselineRanking, overlapAtK, type BaselineKind } from "../engine/model";

const K = 10;
const BASELINES: Record<BaselineKind, { name: string; result: string; how: string }> = {
  popularity: { name: "Most popular", result: "Popularity (earlier-day clicks)", how: "Ranks stories by their click rate in the logs. Same list for everyone." },
  topic: { name: "Topic match only", result: "Topic match (NMF)", how: "Ranks stories by topic overlap with your reads, with no learning from clicks." },
};

export function ComparePage() {
  const { result, user, userName } = useLens();
  const [kind, setKind] = useState<BaselineKind>("popularity");
  const baseline = useMemo(() => baselineRanking(user.historyIds, kind), [user.historyIds, kind]);
  const baseRank = new Map(baseline.map((b) => [b.id, b.rank]));
  const auc = (name: string) => RESULTS.find((r) => r.model === name)?.auc.mean;

  return (
    <>
      <div className="page-head">
        <h1>Trained model vs a simple rule</h1>
        <p>
          Both lists use {userName}'s reads and the same stories. On real held-out clicks, the trained model scores AUC{" "}
          {auc("Logistic regression")?.toFixed(1)} against {auc(BASELINES[kind].result)?.toFixed(1)} for {BASELINES[kind].name.toLowerCase()}.
        </p>
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        {(Object.keys(BASELINES) as BaselineKind[]).map((k) => (
          <button key={k} className={`btn ${kind === k ? "active" : ""}`} onClick={() => setKind(k)}>{BASELINES[k].name}</button>
        ))}
        <span className="small muted">Overlap in the top {K}: {Math.round(overlapAtK(baseline.map((b) => b.id), result.ranked.map((r) => r.id), K) * 100)}%</span>
      </div>
      <div className="grid-2">
        <section className="card" aria-labelledby="b-h">
          <div className="section-title"><h2 id="b-h">{BASELINES[kind].name}</h2><span className="badge">Rule · AUC {auc(BASELINES[kind].result)?.toFixed(1)}</span></div>
          <p className="small muted">{BASELINES[kind].how} No explanation, no controls.</p>
          {baseline.slice(0, K).map((b) => (
            <div className="compare-item" key={b.id}>
              <span className="rank">{b.rank}</span>
              <div>{ARTICLE_BY_ID.get(b.id)?.title}</div>
              <span className="small muted num">{b.score.toFixed(3)}</span>
            </div>
          ))}
        </section>
        <section className="card" aria-labelledby="l-h">
          <div className="section-title"><h2 id="l-h">TopicLens</h2><Evidence kind="computed">Trained · AUC {auc("Logistic regression")?.toFixed(1)}</Evidence></div>
          <p className="small muted">The trained model with your controls. Each item shows its reason and how far it moved against the rule.</p>
          {result.ranked.slice(0, K).map((r) => {
            const br = baseRank.get(r.id);
            const delta = br !== undefined ? br - r.rank : undefined;
            return (
              <div className="compare-item" key={r.id}>
                <span className="rank">{r.rank}</span>
                <div>
                  <div>{ARTICLE_BY_ID.get(r.id)?.title}</div>
                  <div className="row" style={{ margin: "3px 0" }}>{r.topTopics.slice(0, 2).map((t) => <TopicChip key={t} topic={t} />)}</div>
                  <div className="small muted">{shortExplanation(r)}</div>
                </div>
                <span className={`small num ${delta && delta > 0 ? "delta-up" : delta && delta < 0 ? "delta-down" : "muted"}`} title="Rank difference vs the rule">
                  {delta === undefined ? "new" : delta === 0 ? "same" : `${delta > 0 ? "▲" : "▼"}${Math.abs(delta)}`}
                </span>
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
}
