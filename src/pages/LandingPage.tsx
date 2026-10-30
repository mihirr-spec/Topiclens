import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight, BookOpenText, CaretDown, ChatCircleDots, ClipboardText, EnvelopeSimple, FileMagnifyingGlass, FileText, GearSix,
  GoogleLogo, GraduationCap, Graph, Lightbulb,
} from "@phosphor-icons/react";
import { demoAccount, emailAccount, GOOGLE_CLIENT_ID, googleAccount, guestAccount, loadGoogleIdentity, type Account } from "../auth";
import { Arrow, Circled, Crown, SketchDefs, Sparks, Star, Underline, Wordmark } from "../components/sketch";
import { APP_MODEL_RESULT, ARTICLE_BY_ID, BEST_RESULT, categoryName, META, PAPER, PERSONAS, POOL, RESULTS, SHOWCASE, TOPICS } from "../data/mind";
import { positiveShares, signalName } from "../engine/explain";
import { DEFAULT_PREFS, recommend } from "../engine/model";

const fmt = (n: number) => n.toLocaleString("en-US");
const BLUE = "var(--blue)";
const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

/** Adds `is-in` when scrolled into view; CSS does the (reduced-motion aware) transition. */
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      el?.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.classList.add("is-in");
        io.disconnect();
      }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ ["--d" as string]: `${delay}ms` }}>{children}</div>;
}

export function LandingPage({ onSignIn }: { onSignIn: (a: Account) => void }) {
  return (
    <div className="sk">
      <SketchDefs />
      <header className="sk-nav">
        <div className="sk-wrap sk-nav-inner">
          <a href="#top" aria-label="TopicLens home"><Wordmark /></a>
          <nav aria-label="Landing">
            <a href="#how">How it works</a>
            <a href="#who">Who it's for</a>
            <a href="#results">Results</a>
            <a href="#join">Demo</a>
          </nav>
          <a className="ink-btn sm" href="#join">Sign in <ArrowRight size={16} weight="bold" aria-hidden="true" /></a>
        </div>
      </header>

      <main id="top">
        <Hero />
        <WhoFor />
        <HowItWorks />
        <FrontPage />
        <InsideAPick />
        <Results />
        <DataBand />
        <Join onSignIn={onSignIn} />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}

/* ── Hero: the "A news feed that shows its working" mock-up ───────────────── */

function Clipping({ id, src, title, category, abstract, className = "", style }: {
  id: string; src: string; title: string; category: string; abstract?: string; className?: string; style?: React.CSSProperties;
}) {
  return (
    <figure className={`clipping ${className}`} style={style} data-id={id}>
      <span className="clipping-cat">{categoryName(category)}</span>
      <img src={src} alt="" referrerPolicy="no-referrer" />
      <figcaption>
        <b>{title}</b>
        {abstract && <span>{firstSentence(abstract)}</span>}
      </figcaption>
    </figure>
  );
}

function Hero() {
  // Six real MIND stories with photos, one per section where possible.
  const picks = useMemo(() => {
    const seen = new Set<string>();
    return SHOWCASE.filter((s) => (seen.has(s.category) ? false : (seen.add(s.category), true))).concat(SHOWCASE).slice(0, 6);
  }, []);
  return (
    <section className="sk-hero">
      <div className="sk-wrap sk-hero-grid">
        <div className="sk-hero-copy">
          <p className="label enter">A research project</p>
          <h1 className="enter" style={{ ["--d" as string]: "80ms" }}>
            A news feed that <span className="nowrap">shows its <Circled>working.</Circled></span>
            <Sparks className="sk-hero-sparks" />
          </h1>
          <p className="sk-lede enter" style={{ ["--d" as string]: "160ms" }}>
            TopicLens learns from what you read, click and tell it, and puts the news you're most likely to want first.
            The reason for every pick is one tap away.
          </p>
          <div className="sk-ctas enter" style={{ ["--d" as string]: "240ms" }}>
            <a className="ink-btn" href="#join">Sign in <ArrowRight size={18} weight="bold" aria-hidden="true" /></a>
            <a className="pen-btn" href="#join">Try a demo</a>
          </div>
        </div>
        <div className="sk-clippings" aria-label="Real stories from the dataset">
          {picks.map((s, i) => (
            <Clipping key={s.id} {...s} abstract={ARTICLE_BY_ID.get(s.id)?.abstract} className={`clip-${i} enter`}
              style={{ ["--d" as string]: `${200 + i * 90}ms` }} />
          ))}
          <Crown className="sk-crown" />
          <span className="sk-note sk-note-why">Why?</span>
          <Arrow className="sk-arrow-why" />
          <span className="sk-note sk-note-real">Real news.<br />Real reasons.</span>
          <Arrow className="sk-arrow-real" />
        </div>
      </div>
    </section>
  );
}

/* ── Who it's for: the four-card mock-up ──────────────────────────────────── */

const AUDIENCES = [
  { n: "01", icon: BookOpenText, t: "Curious readers", d: "See the reasons, steer the feed." },
  { n: "02", icon: GraduationCap, t: "Students", d: "A working end-to-end example: data, features, models, metrics." },
  { n: "03", icon: FileMagnifyingGlass, t: "Researchers", d: "Exact score breakdowns for explainable AI." },
  { n: "04", icon: ClipboardText, t: "Reviewers", d: "Every number is labelled: measured here, from the paper, or not yet evaluated." },
];

function WhoFor() {
  return (
    <section className="sk-section sk-who" id="who">
      <div className="sk-wrap sk-who-grid">
        <Reveal className="sk-who-copy">
          <h2 className="sk-h2 sk-who-title">Who <Circled color={BLUE}>it's</Circled> for</h2>
          <Underline width={300} />
          <p className="sk-lede">Built for anyone who wants to understand why a story lands in their feed.</p>
          <Arrow className="sk-arrow-who" />
          <p className="sk-note sk-note-blue">Same news.<br />Different perspectives.<br /><u>You decide.</u></p>
        </Reveal>
        <div className="sk-who-cards">
          {AUDIENCES.map(({ n, icon: Icon, t, d }, i) => (
            <Reveal key={n} delay={i * 90} className={`paper-card tilt-${i}`}>
              <span className="blob">{n}</span>
              <Icon className="paper-icon" size={46} weight="regular" aria-hidden="true" />
              <h3>{t}</h3>
              <Underline color={BLUE} width={140} className="paper-underline" />
              <p>{d}</p>
            </Reveal>
          ))}
          <Reveal className="sk-transparent" delay={360}>
            <Circled color={BLUE}>Transparent by design.</Circled>
            <Star className="sk-star" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── How it works: the five-step zigzag mock-up ───────────────────────────── */

const STEPS = [
  { icon: FileText, t: "Choose your interests", d: "Pick the sections you want, or start as a real demo reader. Change them any time." },
  { icon: Graph, t: "Learn topic signals", d: `${TOPICS.length} topics are learned from the text of ${fmt(META.news)} news articles.` },
  { icon: GearSix, t: "Rank what you'll want", d: `A model trained on ${fmt(META.train_impressions)} real visits ranks every story by how likely you are to click it.` },
  { icon: ChatCircleDots, t: "Learn from what you do", d: "Every story you open, pass over, like, hide or mute reshapes your next feed." },
  { icon: Lightbulb, t: "See why, when you want", d: "Each pick carries its reasons: the signals, past reads and words behind it." },
];

function HowItWorks() {
  return (
    <section className="sk-section sk-how" id="how">
      <div className="sk-wrap sk-how-grid">
        <Reveal className="sk-how-copy">
          <p className="label">A simple, transparent process</p>
          <h2 className="sk-h2 sk-how-title">How it works</h2>
          <Underline width={320} />
          <p className="sk-lede">From your interests and clicks to a feed that keeps learning, with the reasons always available.</p>
          <a className="pen-btn" href="#inside">Learn more <ArrowRight size={18} weight="bold" aria-hidden="true" /></a>
        </Reveal>
        <ol className="sk-steps">
          <svg className="sk-steps-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M58 12 C 78 14, 80 22, 70 28 C 56 36, 44 38, 50 46 C 56 54, 80 56, 72 64 C 64 72, 46 70, 52 84" />
          </svg>
          {STEPS.map(({ icon: Icon, t, d }, i) => (
            <li key={t} className={`sk-step step-${i}`}>
              <Reveal delay={i * 90} className="paper-card step-card">
                <span className="blob">{i + 1}</span>
                <span className="step-icon"><Icon size={34} aria-hidden="true" /></span>
                <div>
                  <h3>{t}</h3>
                  <Underline width={80} className="paper-underline" />
                  <p>{d}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Front page: most-clicked real stories ─────────────────────────────────── */

function FrontPage() {
  const top = useMemo(() => [...POOL].filter((a) => a.image).sort((a, b) => b.pop.prior_clicks - a.pop.prior_clicks).slice(0, 10), []);
  return (
    <section className="sk-section sk-front">
      <div className="sk-wrap">
        <Reveal>
          <h2 className="sk-h2">Today's most-clicked</h2>
          <p className="sk-lede">The top 10 stories by real clicks in the data, the day the model is tested on.</p>
        </Reveal>
      </div>
      <div className="sk-rail" role="list">
        {top.map((a, i) => (
          <a key={a.id} role="listitem" className="sk-top" href={a.url} target="_blank" rel="noreferrer">
            <span className="sk-top-num" aria-hidden="true">{i + 1}</span>
            <Clipping id={a.id} src={a.image!.src} title={a.title} category={a.category} />
          </a>
        ))}
      </div>
    </section>
  );
}

/* ── See inside a pick ────────────────────────────────────────────────────── */

function InsideAPick() {
  const persona = PERSONAS[0];
  const top = useMemo(() => recommend(persona.historyIds, DEFAULT_PREFS).ranked[0], [persona]);
  const a = ARTICLE_BY_ID.get(top.id)!;
  const parts = positiveShares(top).slice(0, 4);
  const hist = top.historyEvidence[0];
  return (
    <section className="sk-section sk-inside" id="inside">
      <div className="sk-wrap sk-inside-grid">
        <Reveal>
          <h2 className="sk-h2">See inside a <Circled>pick.</Circled></h2>
          <p className="sk-lede">
            {persona.name} is a real, anonymised Microsoft News reader from the data. This is the story the trained model
            puts first for them, and exactly why. Every pick comes with the same breakdown.
          </p>
        </Reveal>
        <Reveal delay={120} className="paper-card sk-pick">
          {a.image && <img src={a.image.src} alt="" referrerPolicy="no-referrer" />}
          <div>
            <p className="label">#1 for {persona.name}, {Math.round(top.prob * 100)}% match</p>
            <h3 className="serif">{a.title}</h3>
            <p className="sk-pick-sub">{categoryName(a.category)}. Why it was picked:</p>
            {parts.map(({ c, share }, i) => (
              <div key={c.feature} className="ink-bar" style={{ ["--w" as string]: `${share * 100}%`, ["--d" as string]: `${300 + i * 120}ms` }}>
                <span>{signalName(c)}</span>
                <span className="ink-bar-fill" aria-hidden="true" />
                <b>{Math.round(share * 100)}%</b>
              </div>
            ))}
            {hist && hist.pull > 0 && <p className="sk-pick-foot">Closest past read: <b>{ARTICLE_BY_ID.get(hist.id)?.title}</b></p>}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Results ──────────────────────────────────────────────────────────────── */

function Results() {
  const rows = [...RESULTS].sort((a, b) => b.auc.mean - a.auc.mean);
  const lo = 48, hi = Math.max(PAPER.auc, BEST_RESULT.auc.mean) + 1;
  const w = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <section className="sk-section sk-results" id="results">
      <div className="sk-wrap sk-results-grid">
        <Reveal>
          <p className="label">Measured, not claimed</p>
          <h2 className="sk-h2">We tested it on {fmt(META.dev_impressions)} visits it never saw.</h2>
          <Underline width={300} />
          <div className="sk-big">
            <div><Circled><b>{BEST_RESULT.auc.mean.toFixed(1)}</b></Circled><span>AUC, best model<br />({BEST_RESULT.model})</span></div>
            <div><b>50</b><span>AUC of a coin flip</span></div>
            <div><b>{PAPER.auc.toFixed(1)}</b><span>the paper's neural model, from its paper</span></div>
          </div>
          <p className="sk-small">AUC: how often a clicked story ranks above an unclicked one. Every model below was trained on {fmt(META.train_impressions)} real visits.</p>
        </Reveal>
        <Reveal delay={120} className="paper-card sk-chart">
          {rows.map((r) => (
            <div key={r.model} className={`sk-chart-row ${r.model === APP_MODEL_RESULT?.model ? "is-app" : ""}`}>
              <span>{r.model}</span>
              <span className="sk-chart-bar" style={{ width: w(r.auc.mean) }} />
              <b>{r.auc.mean.toFixed(1)}</b>
            </div>
          ))}
          <p className="sk-small">Underlined: the model the app ranks with (every pick splits exactly into its reasons).</p>
        </Reveal>
      </div>
    </section>
  );
}

function DataBand() {
  return (
    <section className="sk-section sk-data" id="data">
      <div className="sk-wrap">
        <Reveal>
          <h2 className="sk-h2">Real readers. Real clicks.</h2>
          <p className="sk-lede">
            From MIND, the Microsoft News Dataset (Wu et al., ACL 2020): what people were shown on Microsoft News and what
            they clicked, November 2019. The same benchmark the published research uses.
          </p>
        </Reveal>
        <Reveal className="sk-stats" delay={100}>
          <div><b>{fmt(META.news)}</b><span>news articles</span></div>
          <div><b>{fmt(META.users)}</b><span>anonymised readers</span></div>
          <div><b>{fmt(META.train_impressions + META.dev_impressions)}</b><span>visits with real clicks</span></div>
          <div><b>{(META.candidate_rows / 1e6).toFixed(1)}M</b><span>stories shown, {(META.click_rate * 100).toFixed(1)}% clicked</span></div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Join ─────────────────────────────────────────────────────────────────── */

function Join({ onSignIn }: { onSignIn: (a: Account) => void }) {
  return (
    <section className="sk-section sk-join" id="join">
      <div className="sk-wrap sk-join-grid">
        <div>
          <Reveal>
            <h2 className="sk-h2">Start with your interests, or borrow a <Circled color={BLUE}>real</Circled> reader's.</h2>
            <p className="sk-lede">Demo readers are anonymised Microsoft News users from the data, with their actual reading history.</p>
          </Reveal>
          <ul className="sk-personas">
            {PERSONAS.map((p, i) => {
              const cover = p.historyIds.map((id) => ARTICLE_BY_ID.get(id)).reverse().find((a) => a?.image);
              return (
                <li key={p.id}>
                  <Reveal delay={i * 80}>
                    <button className="paper-card sk-persona" onClick={() => onSignIn(demoAccount(p.id))}>
                      <span className="sk-persona-cover">{cover?.image && <img src={cover.image.src} alt="" referrerPolicy="no-referrer" />}</span>
                      <span className="sk-persona-body">
                        <b>{`Continue as ${p.name}`}</b>
                        <span>{p.interests.map(categoryName).join(", ")}, {p.historyIds.length} reads</span>
                      </span>
                      <ArrowRight size={22} aria-hidden="true" />
                    </button>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>
        <Reveal delay={120}><SignInCard onSignIn={onSignIn} /></Reveal>
      </div>
    </section>
  );
}

const FAQ = [
  { q: "Is this a real dataset?", a: `Yes. MIND is real, anonymised Microsoft News logs: ${fmt(META.train_impressions + META.dev_impressions)} visits from ${fmt(META.users)} readers, and what they clicked.` },
  { q: "How does it decide what to show me?", a: "A model trained on real Microsoft News clicks scores every story from your reading and clicking history (topic match, wording, the sections you read), plus popularity and freshness. Your chosen sections, the stories you open or pass over, and your More / Less / Not interested feedback adjust it as you go. The trained model was picked after comparing it with KNN, SVMs, random forests, gradient boosting and a neural network." },
  { q: "How accurate is it?", a: `On ${fmt(META.dev_impressions)} visits it never saw, the app's model scores AUC ${APP_MODEL_RESULT?.auc.mean.toFixed(1)} (50 is a coin flip). The paper's larger neural model reports ${PAPER.auc.toFixed(1)}.` },
  { q: "Is my data sent anywhere?", a: "No. The model runs in your browser; your profile and history stay on this device." },
  { q: "Is this a real news app?", a: "No. It's a university research prototype built on a published paper, using 2019 news." },
];

function Faq() {
  return (
    <section className="sk-section sk-faq">
      <div className="sk-wrap">
        <Reveal><h2 className="sk-h2">Questions?</h2></Reveal>
        <div className="sk-faq-list">
          {FAQ.map((f) => (
            <details key={f.q} className="paper-card">
              <summary>{f.q}<CaretDown size={22} aria-hidden="true" /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="sk-footer">
      <div className="sk-wrap sk-footer-grid">
        <div><Wordmark /><p>A university research prototype. Not a news product.</p></div>
        <div>
          <b>Built on</b>
          <p>Liu, Greene, Li, Jiang &amp; Dong (2024). Topic-Centric Explanations for News Recommendation. ACM TORS 3(2). <a href="https://doi.org/10.1145/3680295" target="_blank" rel="noreferrer">doi:10.1145/3680295</a></p>
        </div>
        <div>
          <b>Data</b>
          <p>Wu et al. (2020). MIND: A Large-scale Dataset for News Recommendation. <a href={META.url} target="_blank" rel="noreferrer">msnews.github.io</a>. {META.license}.</p>
        </div>
      </div>
      <details className="sk-wrap sk-credits">
        <summary>Photo credits ({SHOWCASE.length} images from Wikimedia Commons)</summary>
        <ul>
          {SHOWCASE.map((s) => <li key={s.id}><a href={s.credit.page} target="_blank" rel="noreferrer">{s.credit.author || "Unknown author"}</a>, {s.credit.license || "see file page"}</li>)}
        </ul>
      </details>
    </footer>
  );
}

function SignInCard({ onSignIn }: { onSignIn: (a: Account) => void }) {
  const [mode, setMode] = useState<"choose" | "email">("choose");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSignIn(emailAccount(name, email));
  };
  return (
    <div className="paper-card sk-signin">
      <h3>Sign in to your feed</h3>
      <p>Your profile and history are saved in this browser, and nowhere else.</p>
      {mode === "choose" ? (
        <div className="sk-signin-options">
          <GoogleButton onSignIn={onSignIn} />
          <button className="pen-btn block" onClick={() => setMode("email")}><EnvelopeSimple size={20} aria-hidden="true" /> Continue with email</button>
          <div className="sk-divider"><span>or</span></div>
          <button className="text-btn block" onClick={() => onSignIn(guestAccount())}>Continue as guest</button>
        </div>
      ) : (
        <form className="sk-signin-options" onSubmit={submit}>
          <label className="sk-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus /></label>
          <label className="sk-field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-describedby="email-help" />
            <small id="email-help">No password needed: there's no server to check one. The same email brings your profile back.</small>
          </label>
          <button className="ink-btn block" type="submit">Continue</button>
          <button type="button" className="text-btn block" onClick={() => setMode("choose")}>Other options</button>
        </form>
      )}
    </div>
  );
}

function GoogleButton({ onSignIn }: { onSignIn: (a: Account) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let live = true;
    loadGoogleIdentity()
      .then((gis) => {
        if (!live || !ref.current) return;
        gis.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (r) => {
            try {
              onSignIn(googleAccount(r.credential));
            } catch {
              setError("Google sign-in didn't complete. Please try again.");
            }
          },
        });
        gis.renderButton(ref.current, { theme: "outline", size: "large", text: "continue_with", shape: "pill", width: ref.current.clientWidth || 320 });
        setReady(true);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [onSignIn]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div>
        <button className="pen-btn block" disabled aria-describedby="g-hint"><GoogleLogo size={20} weight="bold" aria-hidden="true" /> Continue with Google</button>
        <p id="g-hint" className="sk-small">Google sign-in isn't set up on this copy. Use email or guest instead.</p>
      </div>
    );
  }
  return (
    <div>
      <div ref={ref} className="gsi-slot" aria-busy={!ready} />
      {!ready && !error && <div className="skeleton" style={{ height: 44, borderRadius: 999, margin: 0 }} />}
      {error && <p className="sk-small" role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
