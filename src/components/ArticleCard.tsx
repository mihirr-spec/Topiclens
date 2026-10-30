import { useEffect, useRef } from "react";
import { useLens } from "../context";
import { ARTICLE_BY_ID, categoryName, MODEL } from "../data/mind";
import { LIMITATIONS_NOTE, longExplanation, positiveShares, shortExplanation, signalName } from "../engine/explain";
import { effectiveMultiplier, type Recommendation } from "../engine/model";
import { Evidence, HighlightedText, pct, TopicChip } from "./shared";

export function ArticleCard({ rec, open, onToggle, onRead }: { rec: Recommendation; open: boolean; onToggle: () => void; onRead: (rec: Recommendation) => void }) {
  const { dispatch, user, result } = useLens();
  const a = ARTICLE_BY_ID.get(rec.id)!;
  const liked = user.prefs.liked.includes(rec.id);
  // Opening a story is a click: it joins the reading history and the feed re-ranks, as in MIND's logs.
  // The original MSN pages are offline, so the story opens in the in-app reader.
  const onOpen = () => {
    onRead(rec);
    dispatch({ type: "click", id: rec.id, passedOver: result.ranked.slice(0, rec.rank - 1).map((r) => r.id) });
  };

  return (
    <article className={`feed-card ${a.image ? "has-image" : ""}`} aria-labelledby={`t-${rec.id}`}>
      {a.image && (
        <button className="feed-thumb" onClick={onOpen} tabIndex={-1} aria-hidden="true">
          <img src={a.image.src} alt="" loading="lazy" referrerPolicy="no-referrer" />
        </button>
      )}
      <div className="feed-body">
        <div className="meta">
          <span className="rank">{String(rec.rank).padStart(2, "0")}</span>
          <span>{categoryName(a.category)}</span>
          <span className="match" title="The model's predicted click probability">{pct(rec.prob)} match</span>
        </div>
        <h3 id={`t-${rec.id}`}><button className="headline-link" onClick={onOpen}>{a.title}</button></h3>
        <p className="summary">{a.abstract}</p>
        <p className="why-line">{shortExplanation(rec)}</p>
        <div className="actions">
          <button className={`act ${liked ? "on" : ""}`} onClick={() => dispatch({ type: "like", id: rec.id })} aria-pressed={liked}>More like this</button>
          <button className="act" onClick={() => dispatch({ type: "dislike", id: rec.id })}>Less like this</button>
          <button className="act" onClick={() => dispatch({ type: "dismiss", id: rec.id })}>Not interested</button>
          <button className="act why" onClick={onToggle} aria-expanded={open} aria-controls={`why-${rec.id}`}>
            {open ? "Hide the breakdown" : "Why this pick?"}
          </button>
        </div>
        {open && <WhyPanel rec={rec} id={`why-${rec.id}`} />}
      </div>
    </article>
  );
}

/** In-app reader. MIND keeps each story's headline and summary; the original MSN pages are no longer online. */
export function ArticleReader({ rec, onClose }: { rec: Recommendation; onClose: () => void }) {
  const { dispatch, user } = useLens();
  const a = ARTICLE_BY_ID.get(rec.id)!;
  const liked = user.prefs.liked.includes(rec.id);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const act = (type: "like" | "dislike" | "dismiss") => {
    dispatch({ type, id: rec.id });
    if (type !== "like") onClose();
  };

  return (
    <div className="reader-backdrop" onClick={onClose}>
      <article className="reader" role="dialog" aria-modal="true" aria-labelledby="reader-title" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} className="reader-close" onClick={onClose} aria-label="Close">×</button>
        {a.image && (
          <figure className="reader-figure">
            <img src={a.image.src} alt="" referrerPolicy="no-referrer" />
            <figcaption>Photo: {a.image.author}, {a.image.license}, via Wikimedia Commons</figcaption>
          </figure>
        )}
        <div className="reader-body">
          <div className="meta"><span>{categoryName(a.category)}</span><span className="match">{pct(rec.prob)} match</span></div>
          <h2 id="reader-title">{a.title}</h2>
          <p className="reader-text">{a.abstract || "No summary was published with this story."}</p>
          <div className="row">{rec.topTopics.map((t) => <TopicChip key={t} topic={t} value={a.topics[t]} />)}</div>
          <p className="why-line"><b>Picked because</b> {shortExplanation(rec).replace(/^./, (c) => c.toLowerCase())}</p>
          <div className="reader-actions">
            <button className={`btn ${liked ? "active" : ""}`} onClick={() => act("like")} aria-pressed={liked}>More like this</button>
            <button className="btn" onClick={() => act("dislike")}>Less like this</button>
            <button className="btn" onClick={() => act("dismiss")}>Not interested</button>
            <a className="btn primary" href={`https://www.bing.com/search?q=${encodeURIComponent(a.title)}`} target="_blank" rel="noreferrer">Find this story on the web ↗</a>
          </div>
          <p className="small muted">
            This story is from the MIND dataset (Microsoft News, November 2019). Microsoft has taken the original pages offline,
            so the headline and summary above are all that remain. Opening it counted as a click, and your feed has updated.
          </p>
        </div>
      </article>
    </div>
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
