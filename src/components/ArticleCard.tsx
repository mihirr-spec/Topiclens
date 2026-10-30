import { useLens } from "../context";
import { ARTICLE_BY_ID, categoryName, MODEL } from "../data/mind";
import { LIMITATIONS_NOTE, longExplanation, positiveShares, shortExplanation, signalName } from "../engine/explain";
import { effectiveMultiplier, type Recommendation } from "../engine/model";
import { Evidence, HighlightedText, pct, TopicChip } from "./shared";

export function ArticleCard({ rec, open, onToggle }: { rec: Recommendation; open: boolean; onToggle: () => void }) {
  const { dispatch, user } = useLens();
  const a = ARTICLE_BY_ID.get(rec.id)!;
  const liked = user.prefs.liked.includes(rec.id);
  // Opening a story is a click: it joins the reading history and the feed re-ranks, as in MIND's logs.
  const onOpen = () => dispatch({ type: "click", id: rec.id });

  return (
    <article className={`feed-card ${a.image ? "has-image" : ""}`} aria-labelledby={`t-${rec.id}`}>
      {a.image && (
        <a className="feed-thumb" href={a.url} target="_blank" rel="noreferrer" onClick={onOpen} tabIndex={-1} aria-hidden="true">
          <img src={a.image.src} alt="" loading="lazy" referrerPolicy="no-referrer" />
        </a>
      )}
      <div className="feed-body">
        <div className="meta">
          <span className="rank">#{rec.rank}</span>
          <span className="match" title="The model's predicted click probability">{pct(rec.prob)} match</span>
          <span>{categoryName(a.category)}</span>
          <a href={a.url} target="_blank" rel="noreferrer" onClick={onOpen}>Read on MSN ↗</a>
        </div>
        <h3 id={`t-${rec.id}`}><a className="headline-link" href={a.url} target="_blank" rel="noreferrer" onClick={onOpen}>{a.title}</a></h3>
        <p className="summary">{a.abstract}</p>
        <div className="row">
          {rec.topTopics.map((t) => <TopicChip key={t} topic={t} value={a.topics[t]} />)}
        </div>
        <p className="why-line"><b>Why:</b> {shortExplanation(rec)}</p>
        <div className="actions">
          <button className={`btn ${liked ? "active" : ""}`} onClick={() => dispatch({ type: "like", id: rec.id })} aria-pressed={liked}>More like this</button>
          <button className="btn" onClick={() => dispatch({ type: "dislike", id: rec.id })}>Less like this</button>
          <button className="btn" onClick={() => dispatch({ type: "dismiss", id: rec.id })}>Not interested</button>
          <button className="btn" onClick={() => dispatch({ type: "read", id: rec.id })}>Mark as read</button>
          <button className="btn primary" onClick={onToggle} aria-expanded={open} aria-controls={`why-${rec.id}`}>
            {open ? "Hide explanation" : "Why am I seeing this?"}
          </button>
        </div>
        {open && <WhyPanel rec={rec} id={`why-${rec.id}`} />}
      </div>
    </article>
  );
}

function WhyPanel({ rec, id }: { rec: Recommendation; id: string }) {
  const { dispatch, user } = useLens();
  const a = ARTICLE_BY_ID.get(rec.id)!;
  const shown = rec.contributions.filter((c) => c.feature !== "impression_size" && Math.abs(c.contribution) > 1e-4);
  const maxAbs = Math.max(...shown.map((c) => Math.abs(c.contribution)), 1e-9);
  const shares = new Map(positiveShares(rec).map((s) => [s.c.feature, s.share]));
  const evidence = rec.historyEvidence.filter((h) => h.pull > 1e-6).slice(0, 3);
  const maxPull = Math.max(...evidence.map((e) => e.pull), 1e-9);
  const sum = rec.contributions.reduce((s, c) => s + c.contribution, 0);

  return (
    <div className="why-panel" id={id}>
      <section>
        <h4>In short <Evidence kind="template" /></h4>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {longExplanation(rec).map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </section>

      <section>
        <h4>What drove the score <Evidence kind="computed" /></h4>
        <p className="small muted">
          Each bar is one signal's push on the trained model's score, compared with an average story. Red pulls it down.
          They add up exactly: {MODEL.intercept.toFixed(2)} + {sum.toFixed(2)} = {rec.logit.toFixed(2)} (log-odds), a {pct(rec.prob)} click chance.
        </p>
        {shown.map((c) => (
          <div key={c.feature} className={`signal ${c.contribution < 0 ? "neg" : "pos"}`}>
            <span className="signal-label">{signalName(c)}</span>
            <span className="signal-track" aria-hidden="true">
              <span className="signal-fill" style={{ width: `${(Math.abs(c.contribution) / maxAbs) * 100}%` }} />
            </span>
            <span className="num">
              {c.contribution > 0 ? "+" : "−"}{Math.abs(c.contribution).toFixed(2)}
              {shares.has(c.feature) && <span className="muted"> · {pct(shares.get(c.feature)!)}</span>}
            </span>
          </div>
        ))}
      </section>

      <section>
        <h4>Your reads behind it <Evidence kind="computed" /></h4>
        <p className="small muted">Past reads ranked by how much they add to the topic and wording signals for this story.</p>
        {evidence.length === 0 && <p className="small">None of your reads is close to this story.</p>}
        {evidence.map((e) => (
          <div key={e.id} className="signal pos">
            <span className="signal-label">{ARTICLE_BY_ID.get(e.id)?.title ?? e.id}</span>
            <span className="signal-track" aria-hidden="true"><span className="signal-fill" style={{ width: `${(e.pull / maxPull) * 100}%` }} /></span>
            <span className="num">+{e.pull.toFixed(3)}</span>
          </div>
        ))}
      </section>

      <section>
        <h4>Topics and words that matched <Evidence kind="computed" /></h4>
        <p style={{ margin: "0 0 8px" }}><HighlightedText text={`${a.title}. ${a.abstract}`} topics={rec.topTopics} /></p>
        <div className="row">
          {rec.topTopics.map((t) => (
            <span key={t} className="row" style={{ gap: 4 }}>
              <TopicChip topic={t} value={a.topics[t]} />
              <span className="small muted">×{effectiveMultiplier(user.prefs, t).toFixed(2)}</span>
              <button className="btn tiny" onClick={() => dispatch({ type: "set-multiplier", topic: t, value: Math.max(0, effectiveMultiplier(user.prefs, t) - 0.5) })}>Less</button>
              <button className="btn tiny danger" onClick={() => dispatch({ type: "toggle-mute", topic: t })}>Mute</button>
            </span>
          ))}
        </div>
      </section>

      <section className="callout">
        <b>What this doesn't know</b>
        <ul>{LIMITATIONS_NOTE.map((s) => <li key={s}>{s}</li>)}</ul>
      </section>
    </div>
  );
}
