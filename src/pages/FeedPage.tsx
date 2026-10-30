import { useState } from "react";
import { ArticleCard } from "../components/ArticleCard";
import { ActivityLog, Bar, EmptyState, Evidence, pct, TopicChip } from "../components/shared";
import { useLens } from "../context";
import { APP_MODEL_RESULT, ARTICLE_BY_ID, CATEGORIES, categoryName, META, MODEL, TOPICS } from "../data/mind";
import type { HiddenReason } from "../engine/model";

const PAGE_SIZE = 10;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function FeedPage() {
  const { result, userName, dispatch } = useLens();
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const ranked = result.ranked.slice(0, limit);
  const total = result.profile.adjusted.reduce((a, b) => a + b, 0) || 1;
  const topTopics = Array.from(result.profile.adjusted, (v, k) => ({ k, share: v / total })).sort((a, b) => b.share - a.share).slice(0, 3);

  return (
    <>
      <section className="greeting">
        <h1>{greeting()}, {userName}.</h1>
        <p>
          {result.ranked.length.toLocaleString("en-US")} stories ranked for you by a model trained on real Microsoft News clicks.
          {topTopics[0]?.share > 0 && " Your feed leans toward:"}
        </p>
        {topTopics[0]?.share > 0 && (
          <div className="row">{topTopics.map((t) => <TopicChip key={t.k} topic={t.k} value={t.share} />)}</div>
        )}
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
          {result.ranked.length > limit && (
            <button className="btn" onClick={() => setLimit((l) => l + PAGE_SIZE)}>Show more ({result.ranked.length - limit} left)</button>
          )}
        </div>
        <aside className="stack">
          <SectionsPanel />
          <TastePanel />
          <HistoryPanel />
          <HiddenPanel />
          <ActivityLog />
          <ModelCard />
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

function TastePanel() {
  const { result } = useLens();
  const total = result.profile.adjusted.reduce((a, b) => a + b, 0) || 1;
  const top = Array.from(result.profile.adjusted, (v, k) => ({ v: v / total, k })).sort((a, b) => b.v - a.v).slice(0, 5);
  return (
    <section className="card" aria-labelledby="taste-h">
      <div className="section-title">
        <h3 id="taste-h">Your taste</h3>
        <Evidence kind="computed" />
      </div>
      {top[0].v === 0 ? <p className="small muted">Read a few stories and your topics will show here.</p> : top.map((t) => (
        <Bar key={t.k} label={TOPICS[t.k].label} value={t.v} max={top[0].v || 1} topic={t.k} display={pct(t.v)} />
      ))}
      <p className="small" style={{ marginTop: 8 }}><a href="#/topics">Adjust topics →</a></p>
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
      {recent.length === 0 ? <p className="small muted">Nothing read yet. Mark stories as read and they'll shape your feed.</p> : (
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

function ModelCard() {
  return (
    <section className="card model-card" aria-labelledby="model-h">
      <h3 id="model-h">How your feed is ranked</h3>
      <p className="small">
        A {MODEL.name.toLowerCase()} trained on {META.train_impressions.toLocaleString("en-US")} real Microsoft News visits.
        {APP_MODEL_RESULT && <> On {APP_MODEL_RESULT.impressions.toLocaleString("en-US")} visits it never saw, it scores <b>AUC {APP_MODEL_RESULT.auc.mean.toFixed(1)}</b> (50 = coin flip).</>}
      </p>
      <a className="small" href="#/results">See all results →</a>
    </section>
  );
}
