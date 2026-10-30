import { useCallback, useEffect, useMemo, useState } from "react";
import { cloudEnabled, useAuth, withInterests, type Account } from "./auth";
import { Avatar, Wordmark } from "./components/brand";
import { LensContext, type LensContextValue } from "./context";
import { ARTICLE_BY_ID, DATA_NOTICE } from "./data/mind";
import { recommend } from "./engine/model";
import { AboutPage } from "./pages/AboutPage";
import { ComparePage } from "./pages/ComparePage";
import { FeedPage } from "./pages/FeedPage";
import { LandingPage } from "./pages/LandingPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { useAppState } from "./state";

const PAGES = [
  { key: "feed", label: "For you" },
  { key: "compare", label: "Compare" },
  { key: "about", label: "About" },
] as const;
type PageKey = (typeof PAGES)[number]["key"];

function pageFromHash(): PageKey {
  const h = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return (PAGES.find((p) => p.key === h)?.key ?? "feed") as PageKey;
}

const PROVIDER_TEXT: Record<Account["provider"], string> = {
  google: "Google account",
  email: cloudEnabled ? "Email account" : "Local profile",
  guest: "Guest",
  demo: "Demo reader",
};

export function App() {
  const auth = useAuth();
  const account = auth.account;

  if (!auth.ready) return <div className="boot" aria-busy="true" />;
  if (!account) {
    return (
      <LandingPage
        onSignIn={auth.signIn}
        cloud={cloudEnabled ? { signUpEmail: auth.signUpEmail, signInEmail: auth.signInEmail, signInGoogle: auth.signInGoogle, signInGuest: auth.signInGuest } : undefined}
      />
    );
  }
  if (account.interests.length === 0) {
    return <OnboardingPage account={account} onDone={(interests) => auth.update(withInterests(account, interests))} onCancel={auth.signOut} />;
  }
  return <Shell key={account.id} account={account} onSignOut={auth.signOut} />;
}

function Shell({ account, onSignOut }: { account: Account; onSignOut: () => void }) {
  const [page, setPage] = useState<PageKey>(pageFromHash);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const title = useCallback((id: string) => ARTICLE_BY_ID.get(id)?.title ?? id, []);
  const active = useMemo(
    () => ({ id: account.id, seedHistoryIds: account.seedHistoryIds, interests: account.interests, cloud: account.cloud }),
    [account.id, account.seedHistoryIds, account.interests, account.cloud],
  );
  const { user, dispatch, ready } = useAppState(title, active);

  const ctx = useMemo<LensContextValue>(() => ({
    user,
    userName: account.name,
    result: recommend(user.historyIds, user.prefs),
    dispatch,
  }), [user, account.name, dispatch]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <a href="#/feed" aria-label="TopicLens, your feed"><Wordmark /></a>
          <nav className="nav" aria-label="Sections">
            {PAGES.map((p) => (
              <a key={p.key} href={`#/${p.key}`} aria-current={page === p.key ? "page" : undefined}>{p.label}</a>
            ))}
          </nav>
          <div className="account">
            <Avatar account={account} />
            <span className="account-name">
              <b>{account.name}</b>
              <span className="muted small">{PROVIDER_TEXT[account.provider]}</span>
            </span>
            <button className="btn" onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      </header>
      <div className="notice-bar" role="note"><div>{DATA_NOTICE}</div></div>
      <main>
        {!ready && <p className="muted" aria-live="polite">Loading your saved feed…</p>}
        {ready && <LensContext.Provider value={ctx}>
          {page === "feed" && <FeedPage />}
          {page === "compare" && <ComparePage />}
          {page === "about" && <AboutPage />}
        </LensContext.Provider>}
      </main>
    </div>
  );
}
