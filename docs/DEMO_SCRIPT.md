# Demo script (about 8 minutes)

**Setup.** `npm run dev`, open http://localhost:5173. If you have used the app before, sign out first.

## 0. Landing page (45 s)

- "TopicLens is a news feed that shows its working. It's built on Liu et al. 2024 and trained on MIND, real
  Microsoft News click logs."
- Scroll through **Who it's for** and **How it works**, then **See inside a pick**: a real reader's #1 story with
  its reasons, computed live.
- Stop at the results chart: "14 models, all tested on 73,152 visits they never saw. The hybrid reaches AUC 66.6;
  the paper's neural model reports 68.1."

## 1. Sign in as a real reader (30 s)

- In **Start with your interests**, click **Continue as Leo**. Leo is an anonymised MIND user who reads mostly sports.
- The greeting shows his taste: College football, NFL trades & teams, College towns & states.

## 2. The feed (1 min)

- #1 is *College football Week 12 primer: Heisman Watch, upset picks, predictions and more*, at a 92% match.
- Each card shows the section, a match percentage (the model's click probability), topic chips and a one-line reason.
- Point at **How your feed is ranked** in the sidebar: a logistic regression trained on 156,965 visits, AUC 63.8.

## 3. "Why am I seeing this?" (1.5 min)

Open it on the #1 story.
- **What drove the score:** one bar per signal (a sub-section Leo reads a lot, similar wording to his reads, a high
  click rate earlier...). Read the caption: the parts add up exactly to the score.
- **Your reads behind it:** the past reads that pushed it up most.
- **Topics and words that matched:** topic words highlighted in the story.
- **What this doesn't know:** association is not cause; the model learned from November 2019 readers.

## 4. Push back (1.5 min)

- On a story, click **Less like this**: it disappears and is listed under **Hidden** with its reason.
- In the Why panel, click **Mute** on a topic: every story mostly about it leaves the feed.
- Show the **Activity log**: each action and its computed effect on the top 10.
- Open **Topics**, drag a slider to ×2 and watch the taste bars change.

## 5. Compare (1 min)

- **Compare** puts the trained model next to a simple rule (Most popular, or Topic match only) for the same reader.
- "On held-out clicks the trained model scores 63.8 AUC; topic match alone scores 51.8, barely above chance."

## 6. Results (1 min)

- The AUC chart with confidence intervals, the full metrics table, what the tree model relies on (earlier-day click
  rate, category, sub-section affinity), and the app model's weights.
- The paper's own Table 5, labelled "from the paper".

## 7. Close (30 s)

"From the paper: the dataset, the metrics, the training objective and the idea of topic-centric explanations. New
here: a model trained on real clicks whose explanations are exact, a comparison of 14 models, and controls that let
readers act on the explanation. Still to do: a user study to test whether this actually helps people."
