import { useEffect, useState } from "react";
import type { Account } from "../auth";
import { Avatar, Wordmark } from "../components/brand";
import { CATEGORIES, categoryName, POOL } from "../data/mind";

const MIN = 2;
const MAX = 5;

/** Cold start: a new account picks sections; their most typical articles become the starting history. */
export function OnboardingPage({ account, onDone, onCancel }: {
  account: Account; onDone: (interests: string[]) => void; onCancel: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  // Arriving from the landing page's sign-in card, start at the top of the picker.
  useEffect(() => window.scrollTo(0, 0), []);
  const toggle = (c: string) =>
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : p.length < MAX ? [...p, c] : p));

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-inner">
          <Wordmark />
          <div className="account">
            <Avatar account={account} />
            <b>{account.name}</b>
            <button className="btn" onClick={onCancel}>Sign out</button>
          </div>
        </div>
      </header>
      <main className="onboarding">
        <p className="eyebrow">Welcome, {account.name}</p>
        <h1>What do you like to read?</h1>
        <p className="muted measure">
          Pick {MIN} to {MAX} sections. Your feed starts from the most-read stories in each; after that, everything
          you read and every bit of feedback reshapes it. You can change topics any time.
        </p>
        <div className="interest-grid" role="group" aria-label="Sections">
          {CATEGORIES.map((c) => {
            const on = picked.includes(c);
            const example = POOL.find((a) => a.category === c);
            return (
              <button
                key={c}
                className={`interest ${on ? "on" : ""}`}
                aria-pressed={on}
                disabled={!on && picked.length >= MAX}
                onClick={() => toggle(c)}
              >
                <span className="interest-head">
                  <b>{categoryName(c)}</b>
                  <span className="check" aria-hidden="true">{on ? "✓" : "+"}</span>
                </span>
                {example && <span className="small muted">e.g. “{example.title}”</span>}
              </button>
            );
          })}
        </div>
        <div className="onboarding-bar">
          <span className="small muted" aria-live="polite">
            {picked.length < MIN ? `Pick ${MIN - picked.length} more` : `${picked.length} selected`}
          </span>
          <button className="btn primary lg" disabled={picked.length < MIN} onClick={() => onDone(picked)}>
            Build my feed →
          </button>
        </div>
      </main>
    </div>
  );
}
