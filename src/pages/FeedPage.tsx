import { useState } from "react";
import { ArticleCard } from "../components/ArticleCard";
import { EmptyState, Evidence, pct } from "../components/shared";
import { useLens } from "../context";
import { ARTICLE_BY_ID, CATEGORIES, categoryName, TOPICS } from "../data/mind";
import type { HiddenReason } from "../engine/model";

const TOP_K = [5, 10, 20];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function FeedPage() {
  const { result, user, userName, dispatch } = useLens();
  const [openId, setOpenId] = useState<string | null>(null);
  const [k, setK] = useState(TOP_K[1]);
  const ranked = result.ranked.slice(0, k);

  return (
    <>
      <section className="greeting">
        <h1>{greeting()}, {userName}.</h1>
        <div className="topk-row">
          <p>
            {user.historyIds.length === 0
              ? <>You haven't read anything yet, so these are the most-clicked stories in your sections. Open a few and the model starts learning what you like.</>
              : <>Your top {k} out of {result.ranked.length.toLocaleString("en-US")} stories, ranked by a model trained on real Microsoft News clicks.</>}
          </p>
          <div className="topk" role="group" aria-label="How many recommendations">
            <span>Show top</span>
            {TOP_K.map((n) => (
              <button key={n} className={n === k ? "on" : ""} aria-pressed={n === k} onClick={() => setK(n)}>{n}</button>
            ))}
          </div>
        </div>
      </section>
      <div className="grid-feed">
        <div className="stack">
          {ranked.length === 0 ? (
            <EmptyState title="You've hidden everything">
              <p className="muted">Your mutes and feedback have filtered out every story. Reset your topic controls to see recommendations again.</p>
              <button className="btn primary" onClick={() => dispatch({ type: "reset-topics" })}>Reset topic controls</button>
            </EmptyState>
          ) : (
            ranked.map((r) => <ArticleCard key={r.id} rec={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} />)
          )}
        </div>
        <aside className="stack">
          <SectionsPanel />
          <HistoryPanel />
          <HiddenPanel />
        </aside>
      </div>
    </>
  );
}

function SectionsPanel() {
  const { user, dispatch } = useLens();
  const chosen = user.prefs.sections ?? [];
  const toggle = (c: string) => {
    const next = chosen.includes(c) ? chosen.filter((x) => x !== c) : [...chosen, c];
    dispatch({ type: "set-sections", sections: next });
  };
  return (
    <section className="card" aria-labelledby="sections-h">
      <div className="section-title">
        <h3 id="sections-h">Your sections</h3>
        <Evidence kind="new" />
      </div>
      <p className="small muted">Pick what you want more of. Stories from these sections get a visible boost on top of the trained model's score.</p>
      <div className="section-chips" role="group" aria-label="Preferred sections">
        {CATEGORIES.map((c) => (
          <button key={c} className={`section-chip ${chosen.includes(c) ? "on" : ""}`} aria-pressed={chosen.includes(c)} onClick={() => toggle(c)}>
            {categoryName(c)}
          </button>
        ))}
      </div>
    </section>
  );
}

function HistoryPanel() {
  const { user, dispatch } = useLens();
  const recent = [...user.historyIds].reverse().slice(0, 8);
  return (
    <section className="card" aria-labelledby="hist-h">
      <div className="section-title">
        <h3 id="hist-h">Recently read</h3>
        <Evidence kind="sample" />
      </div>
      {recent.length === 0 ? <p className="small muted">Nothing read yet. Open a story and it will shape your feed.</p> : (
        <ul className="history-list">
          {recent.map((id) => {
            const a = ARTICLE_BY_ID.get(id);
            return <li key={id}><span className="w">{a ? categoryName(a.category) : ""}</span><span>{a?.title ?? id}</span></li>;
          })}
        </ul>
      )}
      <p className="small muted" style={{ marginTop: 8 }}>The model uses your last 50 reads ({Math.min(user.historyIds.length, 50)} now), all counted equally, as in training.</p>
      <button className="btn danger" style={{ marginTop: 6 }} onClick={() => dispatch({ type: "reset-user" })}>Reset my profile</button>
    </section>
  );
}

function reasonText(r: HiddenReason): string {
  switch (r.kind) {
    case "muted-topic": return `${pct(r.share)} about muted topic ${TOPICS[r.topic].label}`;
    case "less-like-this": return "you chose Less like this";
    case "not-interested": return "you chose Not interested";
  }
}

function HiddenPanel() {
  const { result } = useLens();
  if (result.hidden.length === 0) return null;
  return (
    <section className="card" aria-labelledby="hid-h">
      <div className="section-title">
        <h3 id="hid-h">Hidden from your feed ({result.hidden.length})</h3>
        <Evidence kind="new" />
      </div>
      <ul className="history-list">
        {result.hidden.slice(0, 12).map((h) => (
          <li key={h.id}><span>{ARTICLE_BY_ID.get(h.id)?.title}<span className="muted small"> · {reasonText(h.reason)}</span></span></li>
        ))}
      </ul>
    </section>
  );
}
