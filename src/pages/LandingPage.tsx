import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight, BookOpen, ClipboardText, CursorClick, EnvelopeSimple, FileMagnifyingGlass, GearSix, GoogleLogo,
  GraduationCap, Graph, Lightbulb, ListChecks, Plus,
} from "@phosphor-icons/react";
import { demoAccount, emailAccount, GOOGLE_CLIENT_ID, googleAccount, guestAccount, loadGoogleIdentity, type Account, type AuthResult } from "../auth";

/** Supabase sign-in handlers (cloud mode). Absent in local mode. */
export interface CloudAuth {
  signUpEmail: (name: string, email: string, password: string) => Promise<AuthResult>;
  signInEmail: (email: string, password: string) => Promise<AuthResult>;
  signInGoogle: () => Promise<AuthResult>;
  signInGuest: () => Promise<AuthResult>;
}
import { Eyebrow, Wordmark } from "../components/brand";
import { APP_MODEL_RESULT, ARTICLE_BY_ID, BEST_RESULT, categoryName, META, PAPER, PERSONAS, POOL, RESULTS, SHOWCASE, TOPICS } from "../data/mind";
import { positiveShares, signalName } from "../engine/explain";
import { DEFAULT_PREFS, recommend } from "../engine/model";

const fmt = (n: number) => n.toLocaleString("en-US");
const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

/** Adds `is-in` when scrolled into view; CSS runs the (reduced-motion aware) transition. */
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

export function LandingPage({ onSignIn, cloud }: { onSignIn: (a: Account) => void; cloud?: CloudAuth }) {
  return (
    <div className="ed">
      <header className="ed-nav">
        <div className="ed-wrap ed-nav-inner">
          <a href="#top" aria-label="TopicLens home"><Wordmark /></a>
          <nav aria-label="Landing">
            <a href="#top">Home</a>
            <a href="#how">How it works</a>
            <a href="#results">For Researchers</a>
            <a href="#who">About</a>
          </nav>
          <a className="cta navy sm" href="#join">Try TopicLens <ArrowRight size={16} aria-hidden="true" /></a>
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
        <Join onSignIn={onSignIn} cloud={cloud} />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="ed-hero">
      <div className="ed-hero-photo" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}hero-desk.jpg`} alt="" /></div>
      <div className="ed-wrap" style={{ width: "100%" }}>
        <div className="ed-hero-copy">
          <div className="enter"><Eyebrow>News recommendation</Eyebrow></div>
          <h1 className="ed-h1 enter" style={{ ["--d" as string]: "80ms" }}>
            The news you'll <em>actually</em> want, ranked first.
          </h1>
          <p className="ed-lede enter" style={{ ["--d" as string]: "160ms" }}>
            TopicLens learns from what you read, click and tell it, and puts the stories you're most likely to want at
            the top. The reason for every pick is one tap away.
          </p>
          <div className="ed-ctas enter" style={{ ["--d" as string]: "240ms" }}>
            <a className="cta navy" href="#join">Try TopicLens <ArrowRight size={18} aria-hidden="true" /></a>
            <a className="cta quiet" href="#how">See how it works</a>
          </div>
        </div>
      </div>
    </section>
  );
}

const AUDIENCES = [
  { icon: BookOpen, t: "Curious readers", d: "See the reasons behind recommendations and steer the feed to match your interests." },
  { icon: GraduationCap, t: "Students", d: "A working end-to-end example, including data, features, models, and evaluation metrics." },
  { icon: FileMagnifyingGlass, t: "Researchers", d: "Exact score breakdowns for explainable AI and deeper analysis." },
  { icon: ClipboardText, t: "Reviewers", d: "Every number is labelled, from the paper, or not yet evaluated." },
];

function WhoFor() {
  return (
    <section className="ed-section" id="who">
      <div className="ed-wrap ed-who-grid">
        <Reveal>
          <Eyebrow>Who it's for</Eyebrow>
          <h2 className="ed-h2">Who should be able to <em>trust</em> a recommendation?</h2>
          <p className="ed-lede">
            TopicLens is for anyone who wants a more transparent, controllable news feed, whether you're reading,
            learning, researching, or reviewing.
          </p>
        </Reveal>
        <div className="ed-numbered">
          {AUDIENCES.map(({ icon: Icon, t, d }, i) => (
            <Reveal key={t} delay={i * 80} className="ed-item">
              <div className="ed-num">{String(i + 1).padStart(2, "0")}</div>
              <div className="ed-item-body">
                <Icon size={52} weight="light" aria-hidden="true" />
                <div><h3>{t}</h3><p>{d}</p></div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: ListChecks, t: "Choose your sections", d: "Pick what you want to read, or start as a real demo reader. Change it any time." },
  { icon: Graph, t: "Topics are learned", d: `${TOPICS.length} topics are found in the text of ${fmt(META.news)} real news articles.` },
  { icon: GearSix, t: "A trained model ranks", d: `Trained on ${fmt(META.train_impressions)} real visits, it puts what you're likely to click first.` },
  { icon: CursorClick, t: "It learns as you go", d: "Every story you open, pass over, like, hide or mute reshapes your next feed." },
  { icon: Lightbulb, t: "Reasons on request", d: "Each pick carries the signals, past reads and words behind it." },
];

function HowItWorks() {
  return (
    <section className="ed-section" id="how">
      <div className="ed-wrap ed-how-grid">
        <Reveal className="ed-how-copy">
          <Eyebrow>A simple, transparent process</Eyebrow>
          <h2 className="ed-h2 ed-how-title">How it <em>works</em></h2>
          <span className="ed-how-rule" aria-hidden="true" />
          <p className="ed-lede">
            From your interests to a feed you can control. TopicLens uses a clean, interpretable pipeline to put the
            right stories first, with the reasons on file.
          </p>
          <a className="cta line" href="#inside">Learn more <ArrowRight size={18} aria-hidden="true" /></a>
        </Reveal>
        {/* Steps zigzag: 1, 3, 5 in the left column, 2 and 4 half a card lower on the right. */}
        <ol className="ed-zig">
          <svg className="ed-zig-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M48 9 C 54 9, 54 13, 56 15 M44 33 C 50 31, 51 28, 56 27 M48 48 C 54 47, 54 43, 56 42 M44 70 C 50 68, 51 62, 56 59" />
          </svg>
          {STEPS.map(({ icon: Icon, t, d }, i) => (
            <li key={t} className={`ed-zig-step zig-${i}`}>
              <Reveal delay={i * 90} className="ed-zig-card">
                <span className="ed-zig-num">{i + 1}</span>
                <span className="ed-zig-icon"><Icon size={30} weight="light" aria-hidden="true" /></span>
                <div>
                  <h3>{t}</h3>
                  <span className="ed-zig-rule" aria-hidden="true" />
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

function FrontPage() {
  const top = useMemo(() => [...POOL].filter((a) => a.image).sort((a, b) => b.pop.prior_clicks - a.pop.prior_clicks).slice(0, 7), []);
  const [lead, ...rest] = top;
  return (
    <section className="ed-section">
      <div className="ed-wrap">
        <Reveal>
          <Eyebrow>From the data</Eyebrow>
          <h2 className="ed-h2">The most-clicked stories on <em>test day</em>.</h2>
          <p className="ed-lede">Real Microsoft News stories, ranked by real clicks on 15 November 2019, the day every model is tested on.</p>
        </Reveal>
        <div className="ed-front">
          {lead && (
            <a className="ed-story lead" href={lead.url} target="_blank" rel="noreferrer">
              <img src={lead.image!.src} alt="" referrerPolicy="no-referrer" />
              <span className="kicker">No. 1 · {categoryName(lead.category)}</span>
              <h3>{lead.title}</h3>
              <p>{firstSentence(lead.abstract)}</p>
            </a>
          )}
          {rest.map((a, i) => (
            <a key={a.id} className="ed-story" href={a.url} target="_blank" rel="noreferrer">
              <span className="kicker">No. {i + 2} · {categoryName(a.category)}</span>
              <h3>{a.title}</h3>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function InsideAPick() {
  const persona = PERSONAS[0];
  const top = useMemo(() => recommend(persona.historyIds, DEFAULT_PREFS).ranked[0], [persona]);
  const a = ARTICLE_BY_ID.get(top.id)!;
  const parts = positiveShares(top).slice(0, 4);
  const hist = top.historyEvidence[0];
  return (
    <section className="ed-section" id="inside">
      <div className="ed-wrap ed-inside-grid">
        <Reveal>
          <Eyebrow>Inside a pick</Eyebrow>
          <h2 className="ed-h2">Every pick carries its <em>reasons</em>.</h2>
          <p className="ed-lede">
            {persona.name} is a real, anonymised Microsoft News reader from the data. This is the story the trained model
            puts first for them, split into exactly what put it there.
          </p>
        </Reveal>
        <Reveal delay={120} className="ed-pick">
          {a.image && <img src={a.image.src} alt="" referrerPolicy="no-referrer" />}
          <div>
            <div className="meta"><span className="rank">#1 for {persona.name}</span><span className="match">{Math.round(top.prob * 100)}% match</span><span>{categoryName(a.category)}</span></div>
            <h3>{a.title}</h3>
            {parts.map(({ c, share }, i) => (
              <div key={c.feature} className="ed-bar" style={{ ["--w" as string]: `${share * 100}%`, ["--d" as string]: `${300 + i * 120}ms` }}>
                <span>{signalName(c)}</span>
                <span className="ed-bar-fill" aria-hidden="true" />
                <b>{Math.round(share * 100)}%</b>
              </div>
            ))}
            {hist && hist.pull > 0 && <p className="ed-pick-foot">Closest past read: <b>{ARTICLE_BY_ID.get(hist.id)?.title}</b></p>}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Results() {
  const rows = [...RESULTS].sort((a, b) => b.auc.mean - a.auc.mean);
  const lo = 48, hi = Math.max(PAPER.auc, BEST_RESULT.auc.mean) + 1;
  const w = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <section className="ed-section" id="results">
      <div className="ed-wrap ed-results-grid">
        <Reveal>
          <Eyebrow>For researchers</Eyebrow>
          <h2 className="ed-h2">Measured on {fmt(META.dev_impressions)} visits it <em>never saw</em>.</h2>
          <div className="ed-figures">
            <div><b>{BEST_RESULT.auc.mean.toFixed(1)}</b><span>AUC, best model ({BEST_RESULT.model})</span></div>
            <div><b>50</b><span>AUC of a coin flip</span></div>
            <div><b>{PAPER.auc.toFixed(1)}</b><span>The paper's neural model, from its paper</span></div>
          </div>
          <p className="ed-note">AUC: how often a clicked story ranks above an unclicked one. Every model was trained on {fmt(META.train_impressions)} real visits.</p>
        </Reveal>
        <Reveal delay={120} className="ed-chart">
          {rows.map((r) => (
            <div key={r.model} className={`ed-chart-row ${r.model === APP_MODEL_RESULT?.model ? "is-app" : ""}`}>
              <span>{r.model}</span>
              <span className="ed-chart-bar" style={{ width: w(r.auc.mean) }} />
              <b>{r.auc.mean.toFixed(1)}</b>
            </div>
          ))}
          <p className="ed-note">In navy: the model the app ranks with, because every pick splits exactly into its reasons.</p>
        </Reveal>
      </div>
    </section>
  );
}

function DataBand() {
  return (
    <section className="ed-section" id="data">
      <div className="ed-wrap">
        <Reveal>
          <Eyebrow>The data</Eyebrow>
          <h2 className="ed-h2">Real readers. Real <em>clicks</em>.</h2>
          <p className="ed-lede" style={{ maxWidth: "60ch" }}>
            MIND, the Microsoft News Dataset (Wu et al., ACL 2020): what people were shown on Microsoft News and what they
            clicked, November 2019. The same benchmark the published research uses.
          </p>
        </Reveal>
        <Reveal className="ed-stats" delay={100}>
          <div><b>{fmt(META.news)}</b><span>news articles</span></div>
          <div><b>{fmt(META.users)}</b><span>anonymised readers</span></div>
          <div><b>{fmt(META.train_impressions + META.dev_impressions)}</b><span>visits with real clicks</span></div>
          <div><b>{(META.candidate_rows / 1e6).toFixed(1)}M</b><span>stories shown, {(META.click_rate * 100).toFixed(1)}% clicked</span></div>
        </Reveal>
      </div>
    </section>
  );
}

function Join({ onSignIn, cloud }: { onSignIn: (a: Account) => void; cloud?: CloudAuth }) {
  return (
    <section className="ed-section" id="join">
      <div className="ed-wrap ed-join-grid">
        <div>
          <Reveal>
            <Eyebrow>Try TopicLens</Eyebrow>
            <h2 className="ed-h2">Start with your interests, or a <em>real</em> reader's.</h2>
            <p className="ed-lede">Demo readers are anonymised Microsoft News users from the data, with their actual reading history.</p>
          </Reveal>
          <ul className="ed-personas">
            {PERSONAS.map((p, i) => {
              const cover = p.historyIds.map((id) => ARTICLE_BY_ID.get(id)).reverse().find((a) => a?.image);
              return (
                <li key={p.id}>
                  <Reveal delay={i * 80}>
                    <button className="ed-persona" onClick={() => onSignIn(demoAccount(p.id))}>
                      {cover?.image ? <img src={cover.image.src} alt="" referrerPolicy="no-referrer" /> : <span className="ph" />}
                      <span>
                        <b>{`Continue as ${p.name}`}</b>
                        <span>{p.interests.map(categoryName).join(", ")} · {p.historyIds.length} reads</span>
                      </span>
                      <ArrowRight size={22} aria-hidden="true" />
                    </button>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>
        <Reveal delay={120}>{cloud ? <CloudSignInCard cloud={cloud} /> : <SignInCard onSignIn={onSignIn} />}</Reveal>
      </div>
    </section>
  );
}

const FAQ = [
  { q: "Is this a real dataset?", a: `Yes. MIND is real, anonymised Microsoft News logs: ${fmt(META.train_impressions + META.dev_impressions)} visits from ${fmt(META.users)} readers, and what they clicked.` },
  { q: "How does it decide what to show me?", a: "A model trained on real Microsoft News clicks scores every story from your reading and clicking history (topic match, wording, the sections you read), plus popularity and freshness. Your chosen sections, the stories you open or pass over, and your More / Less / Not interested feedback adjust it as you go. The trained model was picked after comparing it with KNN, SVMs, random forests, gradient boosting and a neural network." },
  { q: "How accurate is it?", a: `On ${fmt(META.dev_impressions)} visits it never saw, the app's model scores AUC ${APP_MODEL_RESULT?.auc.mean.toFixed(1)} and the best model ${BEST_RESULT.auc.mean.toFixed(1)} (50 is a coin flip). The paper's neural model reports ${PAPER.auc.toFixed(1)}.` },
  { q: "Is my data sent anywhere?", a: "No. The model runs in your browser; your profile and history stay on this device." },
  { q: "Is this a real news app?", a: "No. It's a university research prototype built on a published paper, using 2019 news." },
];

function Faq() {
  return (
    <section className="ed-section ed-faq">
      <div className="ed-wrap">
        <Reveal>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="ed-h2">Before you <em>start</em>.</h2>
        </Reveal>
        <div className="ed-faq-list">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}<Plus size={20} aria-hidden="true" /></summary>
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
    <footer className="ed-footer">
      <div className="ed-wrap ed-footer-grid">
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
      <details className="ed-wrap ed-credits">
        <summary>Photo credits ({SHOWCASE.length} images from Wikimedia Commons)</summary>
        <ul>
          {SHOWCASE.map((s) => <li key={s.id}><a href={s.credit.page} target="_blank" rel="noreferrer">{s.credit.author || "Unknown author"}</a>, {s.credit.license || "see file page"}</li>)}
        </ul>
      </details>
    </footer>
  );
}

/** Real accounts in Supabase: email + password, Google, or an anonymous guest. */
function CloudSignInCard({ cloud }: { cloud: CloudAuth }) {
  const [mode, setMode] = useState<"choose" | "signin" | "signup">("choose");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<AuthResult>({});

  const run = async (fn: () => Promise<AuthResult>) => {
    setBusy(true);
    setMsg({});
    const r = await fn();
    setBusy(false);
    setMsg(r);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => (mode === "signup" ? cloud.signUpEmail(name, email, password) : cloud.signInEmail(email, password)));
  };

  return (
    <div className="ed-signin">
      <h3>{mode === "signup" ? "Create your account" : "Sign in to your feed"}</h3>
      <p>Your feed, clicks and preferences are saved to your account and follow you to any device.</p>
      {mode === "choose" ? (
        <div className="ed-signin-options">
          <button className="cta line block" disabled={busy} onClick={() => void run(cloud.signInGoogle)}><GoogleLogo size={18} aria-hidden="true" /> Continue with Google</button>
          <button className="cta line block" disabled={busy} onClick={() => setMode("signin")}><EnvelopeSimple size={18} aria-hidden="true" /> Continue with email</button>
          <div className="ed-divider"><span>or</span></div>
          <button className="cta quiet block" disabled={busy} onClick={() => void run(cloud.signInGuest)}>Continue as guest</button>
        </div>
      ) : (
        <form className="ed-signin-options" onSubmit={submit}>
          <div className="ed-tabs" role="tablist" aria-label="Account">
            <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => { setMode("signin"); setMsg({}); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setMsg({}); }}>Create account</button>
          </div>
          {mode === "signup" && (
            <label className="ed-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          )}
          <label className="ed-field"><span>Email</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label className="ed-field">
            <span>Password</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            {mode === "signup" && <small>At least 6 characters.</small>}
          </label>
          <button className="cta navy block" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
          <button type="button" className="cta quiet block" onClick={() => { setMode("choose"); setMsg({}); }}>Other options</button>
        </form>
      )}
      {msg.error && <p className="ed-hint" role="alert" style={{ color: "var(--danger)" }}>{msg.error}</p>}
      {msg.notice && <p className="ed-hint" role="status" style={{ color: "var(--good)" }}>{msg.notice}</p>}
    </div>
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
    <div className="ed-signin">
      <h3>Sign in to your feed</h3>
      <p>Your profile and history are saved in this browser, and nowhere else.</p>
      {mode === "choose" ? (
        <div className="ed-signin-options">
          <GoogleButton onSignIn={onSignIn} />
          <button className="cta line block" onClick={() => setMode("email")}><EnvelopeSimple size={18} aria-hidden="true" /> Continue with email</button>
          <div className="ed-divider"><span>or</span></div>
          <button className="cta quiet block" onClick={() => onSignIn(guestAccount())}>Continue as guest</button>
        </div>
      ) : (
        <form className="ed-signin-options" onSubmit={submit}>
          <label className="ed-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus /></label>
          <label className="ed-field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-describedby="email-help" />
            <small id="email-help">No password needed: there's no server to check one. The same email brings your profile back.</small>
          </label>
          <button className="cta navy block" type="submit">Continue</button>
          <button type="button" className="cta quiet block" onClick={() => setMode("choose")}>Other options</button>
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
        gis.renderButton(ref.current, { theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width: ref.current.clientWidth || 320 });
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
        <button className="cta line block" disabled aria-describedby="g-hint"><GoogleLogo size={18} aria-hidden="true" /> Continue with Google</button>
        <p id="g-hint" className="ed-hint">Google sign-in isn't set up on this copy. Use email or guest instead.</p>
      </div>
    );
  }
  return (
    <div>
      <div ref={ref} className="gsi-slot" aria-busy={!ready} />
      {!ready && !error && <div className="skeleton" style={{ height: 44, margin: 0 }} />}
      {error && <p className="ed-hint" role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
