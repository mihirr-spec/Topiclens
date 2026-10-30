# Demo script (≈ 8 minutes)

**Setup:**
- Run `npm run dev` and open http://localhost:5173.
- If you've used the app before, select **Asha** and click **Reset this user** in the sidebar.
- The rankings quoted below come from the deterministic model and are checked by `tests/engine.test.ts`.

## 0. Framing (30 s) · *About the Research*

Open **About the Research**.
- "This prototype builds on Liu et al. 2024, *Topic-Centric Explanations for News Recommendation*."
- "The paper explains a neural recommender through topics. We reuse its explanation structure in a small, transparent model, and add something new: users can *act* on the explanation."
- Point at the **Paper vs baseline vs TopicLens** table and the orange boxes in the architecture diagram.

## 1. The user and their history (45 s) · *News Feed*

- Select **Asha (demo user)** and point at **Reading history**. She read 6 tech/AI articles: an open-source language model, AI coding assistants, AI chips, AI regulation, on-device AI phones, and AI phishing.
- Point out the γ percentages: newer reads weigh more.
- Point at **Your topic profile**: *AI & Language Models* dominates. "This was computed from her history, not typed in."

## 2. The recommendation (45 s)

- The top 3 are all **AI application** articles:
  1. *Language model helps aid workers translate rare languages*
  2. *Classroom AI tutors…*
  3. *Hospital pilots AI tool that helps radiologists triage scans*
- Each card shows topic chips and a one-line reason.
- Note the yellow banner: sample data, prototype scorer.

## 3. "Why am I seeing this?" (1.5 min)

Click **Why am I seeing this?** on the radiology article (#3).
- **Summary**, tagged *Template text*: fixed sentences filled with computed numbers.
- **Score by topic**, tagged *Computed by model*: AI & Language Models contributes almost all of the score; Health & Medicine adds a little. Read the caption: "the bars add up to the score".
- **Evidence from your reading history**: the on-device AI phone article and the AI regulation article contribute most.
- **Topic words**: words coloured by topic, e.g. *AI*, *model*, *machine learning* vs *hospital*, *patients*, *doctors*.
- **What this explanation does not know**: an association is not a cause; the model doesn't know why she read things.

## 4. Change a topic (1 min)

In the same panel, click **Mute topic** next to *Health & Medicine*. Alternatively, open **Topic Explorer** and use **Mute** there.

- The radiology article and *Clinics test AI assistant…* disappear from the feed. They are listed under **Hidden** with the reason ("…% about muted topic Health & Medicine").
- The **Activity log** shows the computed change, e.g. "↓ … left the top 10", "↑ … entered the top 10".
- Optional: in the **Topic Explorer**, drag the *AI & Language Models* slider to ×0.25. Security and climate articles move up, and the dashed outline shows the inferred interest next to the adjusted share.

## 5. Feedback buttons (45 s)

- On *AI model forecasts crop yields…* (AI + Climate & Energy), click **More like this**.
  - Climate/energy articles jump 20–30 places: e.g. *Offshore wind farm…* goes #42 → #12 and *Drought shrinks reservoirs…* #39 → #19. They are still just outside the top 10, so the log may only report moves within it.
  - Show the change in the **Topic Explorer** instead: Climate & Energy's share bar grows.
- Click **Not interested** on any article. Only that article is hidden.

## 6. Compare systems (1 min) · *Compare Systems*

- Left: the **TF-IDF baseline**. Same history, no explanation, ignores controls. With defaults its top 6 are T10, T17, T11, T12, T07, T08.
- Right: **TopicLens with your controls**. Each item has chips, a reason, and ▲/▼ versus its baseline rank.
- Toggle **TopicLens defaults** to separate the effect of the model from the effect of the user's controls.
- Stress the honesty point: "overlap@10 says the lists *differ*, not which is *better*."

## 7. Evaluation (1 min) · *Evaluation*

- **Section 1 (measured):**
  - mean NPMI on the sample corpus;
  - explanation coverage 30/30;
  - faithfulness residual 0 (at most floating-point rounding), meaning the explanations sum exactly to the score.
- **Section 2:** recommendation accuracy is **Not yet evaluated**. The sample data has no clicks; `npm run eval:mind` exists for MIND.
- **Section 3:** the paper's own Table 5, clearly attributed and not reproduced.
- **Section 5:** user-study hypotheses H1–H4, all *Not yet evaluated*.

## 8. Close (30 s)

"What's from the paper: topic-centric explanations, the u = Σγβ structure, NPMI, the MIND metrics. What's new: explanations that exactly decompose the score, user control over topics, a feedback loop with a visible change log, and a side-by-side baseline comparison. What we haven't shown: that any of this improves accuracy or trust. That needs MIND training and a user study."
