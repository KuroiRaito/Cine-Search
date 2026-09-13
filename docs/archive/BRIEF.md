# Cine Search — Build Brief

**Owner:** Raman Malani
**Purpose:** Convert an existing TMDB movie/TV app into a credible search & conversational discovery project, built to demonstrate search product thinking for the JioHotstar Search & CVD PM role.
**Repo:** github.com/KuroiRaito/Cine-Search · Live: v0-cine-search.vercel.app
**Status as of this brief:** Vite + React frontend, Supabase auth, TMDB as data source. Search is TMDB's `/search` endpoint. Wishlist, rating, tracking implemented.

---

## 1. Why this project exists

### The honest problem statement

The app currently *has* a search box. It does not *have* a search product. TMDB does the retrieval and ranking; the app renders the response. Anyone technical will spot this in two questions.

The gap being closed: I have ~13 months of PM experience with strong platform execution and instrumentation credentials, but zero shipped work in search, relevance, ranking, NLP, or conversational interfaces — which is the entire substance of the target role. A written case study won't fix that. A system I built, measured, broke, and improved will.

### What "done" looks like

Not: "I built a search engine."
But: "I built a discovery app, then treated search quality as a product problem. Here is my evaluation set, my baseline metrics, the three changes I shipped, what each one moved, and the one that made things worse."

That second sentence is the entire point of this build. Every implementation decision below serves it.

### Success criteria

| Criterion | Test |
|---|---|
| Credible | A search engineer can read the repo and not find an overclaim |
| Measurable | Every change has a before/after number on a fixed eval set |
| PM-shaped | The headline artifact is a PRD with metrics and tradeoffs, not code |
| Relevant | Failure modes chosen mirror JioHotstar's actual problem space |
| Defensible | I can answer "why did you choose that metric" for every metric |

---

## 2. Context: what the target company actually built

Anchor the project to real problems, not textbook ones.

- **Scale:** 500M+ MAU. 300,000+ hours of content across 19 languages. Film, originals, live sport, live events, anime, kids, linear TV channels.
- **CVD (Conversational Voice Discovery):** Launched Feb 2026 with OpenAI. ChatGPT-powered voice and text discovery, branded internally as "Multilingual Cognitive Search." Handles situational prompts — "my parents are visiting, suggest something we can all watch together," "something dramatic but not emotionally exhausting."
- **Two-way integration:** Users asking entertainment questions inside ChatGPT get JioHotstar catalogue results and streaming links back. The discovery surface extends outside their own app.
- **Traction:** Voice discovery has overtaken text. Chief architect Vijay Seshadri: content discovery hadn't meaningfully changed in 15–20 years; conversational is the paradigm shift. CPO Bharath Ram is targeting ~100M connected TVs as the next surface.
- **Live sports angle:** CVD extends to conversational discovery of match moments, scores, player highlights.

**Implication for this build:** English-only title search is the wrong demo. The interesting problems are multilingual queries, Hinglish and transliteration, situational/mood intent, voice-shaped (long, spoken, disfluent) queries, and catalogue scale.

---

## 3. Scope

### In scope
Search quality evaluation, query understanding, zero-result recovery, ranking experimentation, semantic retrieval, a conversational discovery mode, instrumentation, and the written PRD.

### Out of scope
Personalisation from real user history (no user base). Actual ML model training (unnecessary — use embedding and LLM APIs). Production scale engineering. Visual redesign beyond what search surfaces require.

### Constraint to respect
TMDB's catalogue is English-metadata-heavy and skews Hollywood. Indian-language coverage is thin. Do not pretend otherwise — document it as a known limitation of the sandbox and reason about what would change with a real catalogue. Naming that limitation unprompted in an interview reads as rigour.

---

## 4. What to implement

Ordered by signal-per-hour. Ship in order; each phase is independently presentable.

### PHASE 1 — Make it measurable (do this first, no exceptions)

Nothing else means anything without a baseline.

**1.1 Golden query set (~120 queries)**

Build a labelled dataset stored as JSON in `/eval`. Each entry: query string, query category, expected result IDs (ranked or set), notes on why.

Categories to cover, with rough weights:

| Category | ~Count | Examples |
|---|---|---|
| Exact title | 15 | "inception", "breaking bad" |
| Typo / misspelling | 20 | "intersteller", "avengrs", "brekaing bad" |
| Partial / prefix | 10 | "dark kni", "game of thr" |
| Person-led | 15 | "christopher nolan movies", "movies with tom hanks" |
| Franchise / collection | 10 | "avengers all parts", "harry potter in order" |
| Hinglish / transliteration | 15 | "salman bhai ki movie", "hindi comedy picture" |
| Mood / situational | 20 | "something light for a sunday", "sad war movie", "watch with parents" |
| Descriptive plot recall | 10 | "movie where guy loses his memory", "kid alone at home christmas" |
| Attribute-constrained | 5 | "under 2 hours", "released this year" |

Label honestly. For mood queries there is no single right answer — label a *set* of acceptable results and score set-overlap rather than exact rank.

**1.2 Scoring harness**

A script (`npm run eval`) that runs the full set against the current search implementation and prints:

- **Zero-result rate** — % of queries returning nothing. The single most important search health metric. Every zero result is a guaranteed abandoned session.
- **Precision@5** — of the top 5, how many are acceptable.
- **MRR** — reciprocal rank of the first acceptable result. Captures "was the right thing at the top."
- **Recall@10** — for set-answer queries.
- **Per-category breakdown** — the aggregate number hides everything. The story is "typo queries were at 41% zero-result while exact-title was at 0%."

Output a timestamped JSON run into `/eval/runs/` so you can diff runs. Commit every run. The commit history becomes evidence of iteration.

**1.3 Run the baseline and write it down**

Run once against untouched TMDB search. This number is your "before." Do not improve anything until it is committed.

**Deliverable:** a baseline table you can put on a slide.

---

### PHASE 2 — Fix the obvious failures

**2.1 Zero-result recovery ladder**

Implement a cascade, and log which rung caught each query:

1. Exact search
2. Spell correction / fuzzy match (Fuse.js or similar on a local title index)
3. Progressive term dropping — "christopher nolan sci fi movie" → drop "movie" → drop "sci fi"
4. Entity fallback — if a person is detected, return their filmography
5. Never-empty floor — surface trending/related instead of a blank screen, clearly labelled as a fallback, not a result

Re-run eval. Report the zero-result delta per category.

**2.2 Query understanding layer**

Before retrieval, classify the query. Rule-based first (cheap, explainable, fast), LLM fallback for ambiguous cases:

- **Intent type:** title lookup / person lookup / genre browse / mood-descriptive / attribute-filtered / unknown
- **Entity extraction:** person names, title fragments, genres, years, language, runtime constraints
- **Language detection:** English / Hindi / Hinglish-transliterated
- **Route accordingly** — a mood query and a title query should not hit the same retrieval path

Measure routing accuracy against your labelled set. Report the confusion matrix. Note where it fails — that honesty is worth more than a fake 98%.

---

### PHASE 3 — Experiment properly

This phase exists specifically to patch a gap in my resume: the CARS24 conversion win was a phased rollout with a clean baseline, not a controlled A/B. This gives me a real one.

**3.1 Ranking variants**

Build a re-ranker over TMDB candidates scoring on a weighted blend:
`text_match × w1 + popularity × w2 + recency × w3 + rating × w4 + language_match × w5`

Create 2–3 named variants with different weightings (e.g. "Relevance-heavy" vs "Popularity-heavy"). Popularity-heavy will win on head queries and lose badly on tail queries — that tension is the interesting finding, so make sure you can show it.

**3.2 Actual A/B infrastructure**

- Deterministic bucketing by session ID
- Variant recorded on every search event
- A results page (`/experiments`) showing per-variant CTR, click position, zero-result rate, reformulation rate, sample size
- A stated hypothesis and success metric **written before** you look at results — commit it first, timestamped

**3.3 Recruit ~30–50 real users**

Friends, IITK groups, Twitter. Even 200 sessions makes this real rather than synthetic. Be upfront in the PRD that the sample is underpowered and state what n you'd need for significance at your observed effect size. Knowing your test is underpowered and saying so is a stronger signal than a confident result from n=12.

---

### PHASE 4 — The AI layer

**4.1 Semantic search over synopses**

Embed plot overviews, store vectors in Supabase (pgvector). Hybrid retrieval: lexical for title/person queries, semantic for descriptive ones, blended where intent is unclear.

This is what makes "movie where the guy loses his memory" return *Memento*. Run eval before and after specifically on the plot-recall and mood categories. Expect semantic to *hurt* exact-title queries — measure and report that regression. A candidate who reports a regression they caused is a candidate who actually ran the experiment.

**4.2 Conversational discovery mode**

The CVD half of the JD. Build:

- Multi-turn refinement: "something light" → "how long do you have?" → "under 2 hours" → results
- Intent accumulation across turns (hold state — don't re-search from scratch each message)
- Grounding: the LLM may **only** recommend titles retrieved from the catalogue. Never let it free-generate titles. This is the single most important design decision in the feature and the one to talk about in interviews — hallucinating a title the platform doesn't carry is a catastrophic failure in streaming.
- Explainability: each recommendation says *why* ("light, 96 minutes, and you liked two other Wes Anderson films")
- Escape hatch: users must be able to drop back to normal search. Conversational is not always faster.

**4.3 Voice input**

Web Speech API for spoken queries. Low effort, high demo value given voice has overtaken text on their platform. Log the difference between spoken and typed query shape — spoken queries are longer, more conversational, contain disfluencies. Report that as a finding; it's a genuinely useful product insight and it's yours.

**4.4 Query fan-out (stretch)**

How Google's AI Mode works: an LLM decomposes one query into multiple parallel sub-queries across subtopics, retrieves for each, and synthesises. Google's own patent language for it is "query variant generation."

Applied here: "good thriller like Andhadhun" fans out to → similar-tone Hindi thrillers → same director → same lead actor → high-rated dark comedies → then merges and dedupes. Compare fan-out vs single-query retrieval on your eval set. This is an advanced signal and a direct conversation-starter about how modern AI search actually works.

---

### PHASE 5 — Instrumentation & the deliverable

**5.1 Search analytics**

Log per search: query, detected intent, variant, results returned, clicked position, time-to-click, reformulation (another search within 30s), abandonment. Build a `/analytics` dashboard.

This deliberately compounds an existing strength — the UMS instrumentation work — rather than patching a weakness. Say that explicitly when presenting.

**5.2 The PRD** — `/docs/SEARCH_PRD.md`

**This is the artifact I actually send people. The repo is supporting evidence.**

Structure:
1. Problem statement and who hurts
2. Metrics tree — north star, input metrics, guardrails, and why each was chosen over alternatives
3. Baseline: the measured "before," per category
4. Hypotheses, ranked by expected impact and effort
5. What shipped, in order
6. Results per change, including regressions
7. **What failed and why** — the most valuable section. Do not skip it.
8. Known limitations (TMDB catalogue skew, sample size, no personalisation)
9. What I'd build next with a real catalogue and real traffic

**5.3 Repo hygiene — before anyone sees it**

- Repo description currently reads "Fun Project." Change it. Something like: *Search quality experiments on a movie/TV discovery app — eval harness, query understanding, hybrid retrieval.*
- README currently leads with tech stack. Rewrite to lead with the problem, the metrics, the before/after table, then stack.
- **16 open pull requests are sitting on the repo.** Close or merge them. An interviewer clicking through to a pile of stale PRs draws conclusions you don't want.
- Add screenshots/GIFs to the README. Most people won't run it locally.

---

## 5. Sequencing

Referral outreach happens in parallel and does not wait for this.

| Window | Ship | Presentable as |
|---|---|---|
| Week 1 | Phase 1 + 2.1, PRD skeleton, repo hygiene | "I measured my search and cut zero-result rate by X%" |
| Week 2 | Phase 2.2, Phase 3 | "I ran an A/B on ranking and here's what I learned" |
| Week 3 | Phase 4.1, 4.2, 4.3 | "I built semantic + conversational discovery with grounding" |
| Week 4+ | Phase 4.4, Phase 5.1, polish | Full case study |

**If the interview lands early:** Week 1 alone is enough to be honest and impressive. "Here's the baseline, here's the first fix, here's what I'm building next and why" beats a rushed half-built semantic layer. Never present something you can't explain end to end.

---

## 6. Talking about this without overclaiming

**Never say:** "I built a search engine." / "I built an AI search system."

**Do say:** "I built a discovery app on TMDB, then treated search quality as a product problem — I built an eval set, measured a baseline, and ran experiments against it."

**When asked what's yours vs TMDB's:** Answer immediately and specifically. "TMDB provides the catalogue and a basic search endpoint. Everything above it is mine — the eval harness, query understanding and routing, the zero-result ladder, the re-ranker, the semantic layer, and the conversational mode. The base retrieval is theirs." Volunteering this before being asked is the move.

**Have ready:** one thing that failed, one metric you chose and later decided was wrong, and one thing you'd do differently with a real catalogue.

---

## 7. Domain knowledge to hold alongside the build

Things to be able to discuss fluently. Build understanding, not talking points — these get probed.

**Metrics vocabulary**
Zero-result rate · null-and-low rate · CTR@k · MRR · NDCG · time-to-first-play · query reformulation rate · search abandonment · search-to-play conversion · successful session rate · long-click vs short-click as a relevance proxy.

**Search concepts**
Lexical vs semantic vs hybrid retrieval · BM25 and why it's still a strong baseline · embeddings and vector search · reciprocal rank fusion for merging result sets · query rewriting and expansion · spell correction · entity linking · head vs torso vs tail queries · the head/tail tradeoff in popularity-weighted ranking · offline eval vs online eval and why they disagree.

**AI search, current landscape**
- **Google AI Mode / AI Overviews** — query fan-out: an LLM decomposes one query into multiple parallel sub-queries across subtopics and sources, then synthesises. Google's patent term is "query variant generation." Deep Search can issue dozens to hundreds of background queries for complex asks. Fan-out reaches roughly 1.5B users monthly and draws on real-time sources like the Shopping Graph.
- **Netflix** — opt-in conversational search beta on iOS using OpenAI models behind a semantic search layer; natural phrasing like "something scary but not too scary." Also testing proprietary AI voice search on smart TVs with an "Ask" button and mood prompts ("I need a good cry," "something for background noise"), deliberately bypassing Google Assistant and Alexa to keep query data in-house. Early tests handled oddities like "funny kids' shows about death."
- **JioHotstar CVD** — see Section 2.
- **Amazon Fire TV** — open-ended AI voice search, an earlier entrant in the same space.

**The strategic questions to have opinions on**
- Why every major streamer is shipping conversational discovery *now* — catalogue size outgrew browse UI, and LLM inference finally got cheap enough per query.
- Build vs partner: Netflix and JioHotstar both went OpenAI initially; Netflix is now building proprietary voice. What's the tradeoff between speed-to-market and owning the query data?
- Query data as a moat: conversational queries reveal intent that clicks never do. Who owns that data matters enormously, and it's why Netflix is taking voice in-house.
- Discovery beyond the app: JioHotstar recommendations surfacing inside ChatGPT is a distribution strategy, not just a feature. What does it mean when your search box lives in someone else's product?
- Latency vs quality on a TV remote. Conversational is slower than typing a known title — when is it actually worse for the user, and how should the product decide which surface to show?
- Grounding and hallucination: what happens when the assistant confidently recommends a title the platform doesn't carry, and how do you design against it?
- Multilingual at 19 languages: code-switching, transliteration ("bhaijaan" vs "भाईजान"), and regional title variants. Almost certainly their hardest unsolved problem, and the one worth asking *them* about.

---

## 8. Open questions to resolve while building

- How do you fairly evaluate a mood query where "correct" is subjective? (Proposal: acceptable-set labelling with a second labeller for disagreement, and report inter-rater agreement.)
- Where's the line between helpful conversational refinement and annoying interrogation? How many turns before a user gives up?
- Should conversational mode be a separate surface or should the search bar absorb it? What does each choice cost?
- If semantic retrieval regresses exact-title queries, what's the right routing rule — and who decides the threshold?
