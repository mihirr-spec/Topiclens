import { ActivityLog, Bar, Evidence, pct, tc } from "../components/shared";
import { useLens } from "../context";
import { POOL, TOPICS } from "../data/mind";
import { effectiveMultiplier, PARAMS } from "../engine/model";

const articleCount = TOPICS.map((t) => POOL.filter((a) => a.topics[t.index] >= PARAMS.muteThreshold).length);

export function TopicExplorerPage() {
  const { result, user, dispatch } = useLens();
  const { inferred, adjusted } = result.profile;
  const inferredTotal = inferred.reduce((a, b) => a + b, 0) || 1;
  const adjustedTotal = adjusted.reduce((a, b) => a + b, 0) || 1;
  const order = TOPICS.map((t) => t.index).sort((a, b) => inferred[b] - inferred[a]);
  const maxShare = Math.max(...Array.from(inferred, (v) => v / inferredTotal), ...Array.from(adjusted, (v) => v / adjustedTotal), 1e-9);
  const changed = Object.keys(user.prefs.multipliers).length > 0 || user.prefs.muted.length > 0;

  return (
    <>
      <div className="page-head">
        <h1>Tune what you see <Evidence kind="new" /></h1>
        <p>
          These {TOPICS.length} topics were learned from the text of 65,238 Microsoft News articles. The solid bar is each
          topic's share of your profile after your changes; the dashed outline is what your reading alone implies.
          Changes feed straight into the trained model's topic-match signal.
        </p>
        <div className="row">
          <button className="btn" disabled={!changed} onClick={() => dispatch({ type: "reset-topics" })}>Reset all topics</button>
          <span className="small muted">Muting hides stories that are at least {pct(PARAMS.muteThreshold)} about that topic.</span>
        </div>
      </div>
      <div className="grid-feed">
        <section className="card" aria-label="Topics">
          {order.map((k) => {
            const t = TOPICS[k];
            const muted = user.prefs.muted.includes(k);
            const m = user.prefs.multipliers[k] ?? 1;
            return (
              <div key={k} className={`topic-row ${muted ? "muted-row" : ""}`} style={tc(k)}>
                <div>
                  <div className="row" style={{ marginBottom: 2 }}>
                    <span className="chip">{t.label}</span>
                    {muted && <span className="badge" style={{ color: "var(--danger)" }}>muted</span>}
                  </div>
                  <div className="descriptors">{t.words.join(" · ")}</div>
                  <div className="small muted">{articleCount[k]} stories in your feed pool are mostly about this</div>
                </div>
                <Bar label="your share" value={adjusted[k] / adjustedTotal} ghost={inferred[k] / inferredTotal} max={maxShare} topic={k} display={pct(adjusted[k] / adjustedTotal)} />
                <div className="slider-wrap">
                  <label className="small" htmlFor={`m-${k}`}>×{effectiveMultiplier(user.prefs, k).toFixed(2)}</label>
                  <input id={`m-${k}`} type="range" min={0} max={2} step={0.25} value={m} disabled={muted}
                    aria-label={`Interest multiplier for ${t.label}`}
                    onChange={(e) => dispatch({ type: "set-multiplier", topic: k, value: Number(e.target.value) })} />
                  <button className={`btn ${muted ? "active" : "danger"}`} onClick={() => dispatch({ type: "toggle-mute", topic: k })} aria-pressed={muted}>
                    {muted ? "Unmute" : "Mute"}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
        <aside className="stack">
          <div className="callout info">
            <b>How the controls work</b>
            <ul>
              <li>The slider scales your interest in a topic (0 = ignore, 1 = as learned from your reads, 2 = double).</li>
              <li>Mute sets it to 0 <i>and</i> hides stories mostly about that topic.</li>
              <li>The model found these topics without labels; a person named them afterwards from their top words, shown under each name.</li>
            </ul>
          </div>
          <ActivityLog />
        </aside>
      </div>
    </>
  );
}
