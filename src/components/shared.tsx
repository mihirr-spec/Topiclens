import type { CSSProperties, ReactNode } from "react";
import { topicColor, useLens } from "../context";
import { TOPICS } from "../data/mind";

export function tc(topic: number): CSSProperties {
  return { ["--tc" as string]: topicColor(topic) } as CSSProperties;
}

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

export function TopicChip({ topic, value }: { topic: number; value?: number }) {
  return (
    <span className="chip" style={tc(topic)} title={TOPICS[topic].words.join(", ")}>
      {TOPICS[topic].label}
      {value !== undefined && <span className="pct">{pct(value)}</span>}
    </span>
  );
}

export type EvidenceKind = "computed" | "template" | "sample" | "paper" | "new";
const EVIDENCE_TEXT: Record<EvidenceKind, string> = {
  computed: "Computed by model",
  template: "Template text",
  sample: "Real data",
  paper: "From the paper",
  new: "TopicLens extension",
};
export function Evidence({ kind, children }: { kind: EvidenceKind; children?: ReactNode }) {
  return <span className={`badge ${kind}`}>{children ?? EVIDENCE_TEXT[kind]}</span>;
}

export function Bar({ label, value, max, topic, ghost, display }: {
  label: ReactNode; value: number; max: number; topic?: number; ghost?: number; display?: string;
}) {
  const w = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const g = ghost !== undefined && max > 0 ? Math.max(0, Math.min(1, ghost / max)) : undefined;
  return (
    <div className="bar-row" style={topic !== undefined ? tc(topic) : undefined}>
      <span>{label}</span>
      <span className="bar-track" role="img" aria-label={`${typeof label === "string" ? label : ""} ${display ?? value.toFixed(3)}`}>
        <span className="bar-fill" style={{ width: `${w * 100}%`, display: "block" }} />
        {g !== undefined && <span className="bar-ghost" style={{ width: `${g * 100}%` }} />}
      </span>
      <span className="num">{display ?? value.toFixed(3)}</span>
    </div>
  );
}

const stem = (w: string) => w.toLowerCase().replace(/['’]s$/, "").replace(/(ies)$/, "y").replace(/s$/, "");

/** Article text with each topic's top words highlighted in that topic's colour (analogue of the paper's Fig. 8). */
export function HighlightedText({ text, topics }: { text: string; topics: number[] }) {
  const owner = new Map<string, number>();
  for (const t of topics) for (const w of TOPICS[t].words) if (!owner.has(stem(w))) owner.set(stem(w), t);
  const parts = text.split(/([A-Za-z][A-Za-z'’]*)/);
  return (
    <span className="abstract">
      {parts.map((p, i) => {
        const t = owner.get(stem(p));
        return t === undefined ? <span key={i}>{p}</span> : (
          <mark key={i} className="hl" style={tc(t)} title={TOPICS[t].label}>{p}</mark>
        );
      })}
    </span>
  );
}

export function ActivityLog() {
  const { user } = useLens();
  return (
    <section className="card" aria-labelledby="log-h">
      <div className="section-title">
        <h3 id="log-h">Activity log</h3>
        <Evidence kind="computed">Diffs computed</Evidence>
      </div>
      {user.log.length === 0 ? (
        <p className="muted small">No feedback yet. Use the buttons on an article or the Topic Explorer; each change and its effect on your top 10 will be listed here.</p>
      ) : (
        <ul className="log">
          {user.log.map((e) => (
            <li key={e.id}>
              <span className="muted">{e.at}</span> · <b>{e.action}</b>
              <ul className="effects">
                {e.effects.map((x, i) => <li key={i} style={{ border: 0, padding: 0 }}>{x}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card state">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
