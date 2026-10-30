import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { demoAccount, emailAccount, googleAccount, withInterests } from "../src/auth";
import { LensContext, type LensContextValue } from "../src/context";
import { ARTICLE_BY_ID, CATEGORIES, META, MODEL, PERSONAS, POOL, RESULTS, seedHistory, SHOWCASE, TOPICS } from "../src/data/mind";
import { baselineRanking, buildProfile, DEFAULT_PREFS, overlapAtK, PARAMS, recommend, score, type Preferences } from "../src/engine/model";
import { AboutPage } from "../src/pages/AboutPage";
import { ComparePage } from "../src/pages/ComparePage";
import { FeedPage } from "../src/pages/FeedPage";
import { LandingPage } from "../src/pages/LandingPage";
import { OnboardingPage } from "../src/pages/OnboardingPage";
import { diffRankings, type UserState } from "../src/state";

const leo = PERSONAS[0];

describe("exported MIND data", () => {
  it("has real MIND ids, decoded vectors and measured results", () => {
    expect(POOL.length).toBeGreaterThan(500);
    expect(META.train_impressions).toBe(156965);
    expect(META.dev_impressions).toBe(73152);
    for (const a of POOL.slice(0, 50)) {
      expect(a.id).toMatch(/^N\d+$/);
      expect(a.topics.length).toBe(TOPICS.length);
      expect(Math.hypot(...a.emb)).toBeCloseTo(1, 3);
    }
    expect(RESULTS.find((r) => r.model === "Logistic regression")?.auc.mean).toBeGreaterThan(55);
    expect(MODEL.coef.length).toBe(MODEL.features.length);
  });

  it("demo readers are real MIND users whose histories are in the data", () => {
    for (const p of PERSONAS) {
      expect(p.mindUser).toMatch(/^U\d+$/);
      expect(p.historyIds.every((id) => ARTICLE_BY_ID.has(id))).toBe(true);
    }
    expect(SHOWCASE.length).toBeGreaterThan(5);
  });
});

describe("trained-model ranker", () => {
  const res = recommend(leo.historyIds, DEFAULT_PREFS);

  it("matches the logistic regression exactly: intercept + contributions = logit", () => {
    for (const r of res.ranked.slice(0, 20)) {
      const sum = r.contributions.reduce((s, c) => s + c.contribution, 0);
      expect(MODEL.intercept + sum).toBeCloseTo(r.logit, 10);
      expect(r.prob).toBeCloseTo(1 / (1 + Math.exp(-r.logit)), 12);
    }
    const ranked = res.ranked.map((r) => r.logit);
    expect(ranked).toEqual([...ranked].sort((a, b) => b - a));
  });

  it("history evidence reproduces the history part of the topic and text terms", () => {
    const profile = buildProfile(leo.historyIds, DEFAULT_PREFS);
    const top = res.ranked[0];
    const a = ARTICLE_BY_ID.get(top.id)!;
    const x = score(profile, a).contributions;
    const iT = MODEL.features.indexOf("topic_sim"), iE = MODEL.features.indexOf("text_sim");
    const fromHistory = top.historyEvidence.reduce((s, h) => s + h.pull, 0);
    const expected = (MODEL.coef[iT] / MODEL.scale[iT]) * x.find((c) => c.feature === "topic_sim")!.value
      + (MODEL.coef[iE] / MODEL.scale[iE]) * x.find((c) => c.feature === "text_sim")!.value;
    expect(fromHistory).toBeCloseTo(expected, 6); // vectors are float32 in the browser
  });

  it("never recommends what was read; mute, Less like this and Not interested hide stories", () => {
    expect(res.ranked.some((r) => leo.historyIds.includes(r.id))).toBe(false);
    const t = res.ranked[0].topTopics[0];
    const target = res.ranked[1].id;
    const prefs: Preferences = { ...DEFAULT_PREFS, muted: [t], disliked: [target], dismissed: [res.ranked[2].id] };
    const after = recommend(leo.historyIds, prefs);
    expect(after.ranked.every((r) => ARTICLE_BY_ID.get(r.id)!.topics[t] < PARAMS.muteThreshold)).toBe(true);
    expect(after.hidden.find((h) => h.id === target)?.reason.kind).toBe("less-like-this");
    expect(after.ranked.some((r) => r.id === res.ranked[2].id)).toBe(false);
  });

  it("More like this pulls similar stories up", () => {
    const liked = res.ranked[30].id;
    const after = recommend(leo.historyIds, { ...DEFAULT_PREFS, liked: [liked] });
    const likedTopic = ARTICLE_BY_ID.get(liked)!.topics;
    const sim = (id: string) => ARTICLE_BY_ID.get(id)!.topics.reduce((s, v, k) => s + v * likedTopic[k], 0);
    const mean = (ids: string[]) => ids.reduce((s, id) => s + sim(id), 0) / ids.length;
    expect(mean(after.ranked.slice(0, 20).map((r) => r.id))).toBeGreaterThan(mean(res.ranked.slice(0, 20).map((r) => r.id)));
  });

  it("a click joins the history: the story leaves the feed and similar ones rise", () => {
    const clicked = res.ranked[40].id;
    const after = recommend([...leo.historyIds, clicked], DEFAULT_PREFS);
    expect(after.ranked.some((r) => r.id === clicked)).toBe(false);
    const t = ARTICLE_BY_ID.get(clicked)!.topics;
    const sim = (id: string) => ARTICLE_BY_ID.get(id)!.topics.reduce((acc, v, k) => acc + v * t[k], 0);
    const mean = (ids: string[]) => ids.reduce((acc, id) => acc + sim(id), 0) / ids.length;
    expect(mean(after.ranked.slice(0, 20).map((r) => r.id))).toBeGreaterThan(mean(res.ranked.slice(0, 20).map((r) => r.id)));
  });

  it("preferred sections pull their stories up the feed", () => {
    const share = (ids: string[], c: string) => ids.filter((id) => ARTICLE_BY_ID.get(id)!.category === c).length;
    const target = "lifestyle";
    const top = (prefs: Preferences) => recommend(leo.historyIds, prefs).ranked.slice(0, 10).map((r) => r.id);
    expect(share(top({ ...DEFAULT_PREFS, sections: [target] }), target)).toBeGreaterThan(share(top(DEFAULT_PREFS), target));
  });

  it("a chosen section shows up as its own exact reason in the score", () => {
    const target = CATEGORIES.find((c) => c !== "sports" && c !== "news")!;
    const rec = recommend(leo.historyIds, { ...DEFAULT_PREFS, sections: [target] }).ranked.find((r) => ARTICLE_BY_ID.get(r.id)!.category === target)!;
    expect(rec.contributions.find((c) => c.feature === "section_pref")?.contribution).toBeCloseTo(PARAMS.sectionBoost, 12);
    expect(MODEL.intercept + rec.contributions.reduce((acc, c) => acc + c.contribution, 0)).toBeCloseTo(rec.logit, 10);
  });

  it("stories passed over above a click drop, with the skip as an exact reason", () => {
    const passed = res.ranked[0].id;
    const after = recommend(leo.historyIds, { ...DEFAULT_PREFS, skipped: { [passed]: 2 } });
    const rec = after.ranked.find((r) => r.id === passed)!;
    expect(rec.rank).toBeGreaterThan(1);
    expect(rec.contributions.find((c) => c.feature === "skipped")?.contribution).toBeCloseTo(-2 * PARAMS.skipPenalty, 12);
    expect(MODEL.intercept + rec.contributions.reduce((acc, c) => acc + c.contribution, 0)).toBeCloseTo(rec.logit, 10);
    const capped = recommend(leo.historyIds, { ...DEFAULT_PREFS, skipped: { [passed]: 99 } }).ranked.find((r) => r.id === passed)!;
    expect(capped.contributions.find((c) => c.feature === "skipped")?.contribution).toBeCloseTo(-PARAMS.maxSkips * PARAMS.skipPenalty, 12);
  });

  it("overlap@k counts shared items in the top k", () => {
    expect(overlapAtK(["a", "b", "c"], ["c", "x", "a"], 3)).toBeCloseTo(2 / 3);
  });

  it("baselines rank by their single signal", () => {
    const pop = baselineRanking(leo.historyIds, "popularity");
    expect(pop[0].score).toBeGreaterThanOrEqual(pop[1].score);
    expect(baselineRanking(leo.historyIds, "topic").length).toBe(pop.length);
  });
});

describe("accounts", () => {
  it("normalises email profiles and seeds onboarding histories from the pool", () => {
    expect(emailAccount("  Ria ", "Ria@Example.COM ").id).toBe(emailAccount("", "ria@example.com").id);
    const a = withInterests(emailAccount("R", "r@x.org"), [CATEGORIES[0], CATEGORIES[1]]);
    expect(a.seedHistoryIds).toEqual(seedHistory([CATEGORIES[0], CATEGORIES[1]]));
    expect(a.seedHistoryIds.length).toBeGreaterThan(0);
    expect(demoAccount(leo.id).seedHistoryIds).toEqual(leo.historyIds);
  });

  it("reads Google ID-token claims, including non-ASCII names", () => {
    const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const token = `${b64url({ alg: "RS256" })}.${b64url({ sub: "123", given_name: "Riddhimā", email: "r@x.org" })}.sig`;
    expect(googleAccount(token)).toMatchObject({ id: "google:123", provider: "google", name: "Riddhimā" });
  });
});

describe("pages render", () => {
  const ctx = (prefs: Preferences): LensContextValue => {
    const user: UserState = { historyIds: leo.historyIds, prefs, log: [] };
    return { user, userName: leo.name, result: recommend(user.historyIds, prefs), dispatch: () => {} };
  };
  const render = (Page: () => JSX.Element, value: LensContextValue) =>
    renderToString(createElement(LensContext.Provider, { value }, createElement(Page)));

  for (const [name, Page] of Object.entries({ FeedPage, ComparePage, AboutPage })) {
    it(`${name} renders with defaults and with controls applied`, () => {
      expect(render(Page, ctx(DEFAULT_PREFS)).length).toBeGreaterThan(500);
      expect(render(Page, ctx({ ...DEFAULT_PREFS, muted: [0], multipliers: { 1: 2 } })).length).toBeGreaterThan(500);
    });
  }

  it("muting every topic hides each story that is mostly about one; the feed shows its empty state when nothing is left", () => {
    const all = recommend(leo.historyIds, { ...DEFAULT_PREFS, muted: TOPICS.map((t) => t.index) });
    expect(all.ranked.every((r) => Math.max(...ARTICLE_BY_ID.get(r.id)!.topics) < PARAMS.muteThreshold)).toBe(true);
    expect(render(FeedPage, ctx({ ...DEFAULT_PREFS, dismissed: POOL.map((a) => a.id) }))).toContain("hidden everything");
  });

  it("landing page shows every sign-in option and real demo readers", () => {
    const html = renderToString(createElement(LandingPage, { onSignIn: () => {} }));
    for (const s of ["Continue with Google", "Continue with email", "Continue as guest", `Continue as ${leo.name}`, "most-clicked", "How it works", "Who"]) expect(html).toContain(s);
    const onboarding = renderToString(createElement(OnboardingPage, { account: emailAccount("R", "r@x.org"), onDone: () => {}, onCancel: () => {} }));
    expect(onboarding).toContain("What do you like to read?");
  });

  it("activity log diff reports entries and exits", () => {
    const fx = diffRankings(["a", "b", "c"], ["a", "d", "c"], (id) => id.toUpperCase());
    expect(fx.join("\n")).toContain("“D” entered");
    expect(fx.join("\n")).toContain("“B” left");
  });
});
