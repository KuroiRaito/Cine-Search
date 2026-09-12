# Data model — decision record

**Status:** settled 2026-09-12. SQL in `supabase/001_mvp_schema.sql`.
**Goal it answers:** be able to learn what a user likes — genres, keywords, directors, eras, lengths — from **what they save and rate**, not from tracking how they browse.

---

## Six tables

Three are a **shared cache** that fills itself and then goes quiet. Two are the **user's own records**. One is the **account**.

**Naming:** `catalog_*` is shared TMDB data, written server-side and readable by everyone. `user_*` is one person's own data, protected by row-level security. `profiles` keeps Supabase's conventional name so that any signup trigger pointing at it stays intact.

| Table | What it is | Grows with |
|---|---|---|
| `profiles` | The account: username, region override, streaming services, theme | Users |
| `catalog_titles` | The catalogue. One row per film or series, **shared by everyone** | Catalogue coverage — flattens off |
| `catalog_people` | One row per person, plus biography and birthday | Catalogue coverage |
| `catalog_credits` | Who made what. Read from both ends | Catalogue coverage |
| `user_library` | What a person saved, their status, rating, rewatches, **and episode progress** | Users × titles |
| `user_activity` | What someone did, and when | Actions |

---

## Why the catalogue is the important one

A library entry says *"Raman — item 693134 — rated 9."* That cannot answer "what kind of films does Raman like." It's an ID.

**The training data is the library joined to the catalogue.** Genres, keywords, runtime, language, decade, director — those live in `titles` and `title_credits`. Without them there is nothing to learn from.

`keywords` is the strongest signal TMDB offers: not "Drama" but *based on a novel*, *one night*, *unreliable narrator*. That is where taste actually shows up.

**This is not speculative work.** Screen 7 — the Taste screen — reads exactly this data. The model just uses it better later.

### It deduplicates by construction

`(tmdb_id, media_type)` is the primary key, so Blade Runner physically cannot be stored twice. The first user to open it writes the row; every user after that points at the same one.

### It fills lazily, server-side

Nothing is bulk-imported. When someone opens a title we haven't cached, the server stores it — using data we were already fetching to draw the page and previously threw away. Zero extra API calls.

**Written server-side only**, through `api/tmdb` with the service key. Clients can read the catalogue but never write it, so one user can't corrupt shared data everyone depends on.

### Images are never stored

We keep the path — about 30 characters. The picture is served from TMDB's CDN straight to the browser. It never touches the database or your bandwidth.

---

## Episode progress is stacked, not a table

A show's progress lives in one `jsonb` column on the library entry:

```json
{ "1": [1,2,3,4,5,6,7], "2": [1,2,3] }
```

Five series you're watching = **five rows**, not two hundred.

**Roughly 14× lighter** than a row per episode, on the one table that would otherwise have grown without limit. It also removes a table and a join: "show me my library" is a single read.

*Fallback if this ever turns awkward in practice:* a separate `episode_progress` table, one row per user per show, holding the same JSON. Same shape, one more join. Not expected to be needed.

---

## Activity carries the time dimension

Stacking loses per-episode timestamps. **The activity table gives them back** — and it exists as a product feature, not as instrumentation.

When someone logs episodes 21–25 in one sitting, that's **one activity row**, matching how people actually log:

```
episodes_watched · Breaking Bad · { "season": 2, "from": 21, "to": 25 } · 2026-09-12 21:40
```

It does three jobs:

1. **Now** — the timestamps that stacking gave up
2. **Later** — the social feed, exactly as AL-chan shows it ("watched 3 episodes of…")
3. **Always** — a time dimension for modelling: *when* someone got into Korean thrillers, how fast they finish things, whether taste moved

**Write to it from day one, display it when the social layer lands.** Schema is cheap to add later; the months of data you didn't record are gone for good.

Private in the MVP. When following arrives, add a second read policy for followers — no schema change.

---

## What each unusual column is for

| Column | Why |
|---|---|
| `titles.keywords` | The richest taste signal available |
| `titles.runtime` | "Never finishes anything over two hours" is real taste |
| `titles.original_language` | Foreign-language affinity |
| `titles.vote_count` / `popularity` | Crowd-pleasers vs obscurities — a genuine dimension, free to capture |
| `titles.last_aired_*` | The aired-episode denominator, computed without extra calls |
| `library_entries.added_at` / `started_at` / `completed_at` | Most of what an events table would have given, for three columns |
| `library_entries.recommended_by` | The differentiator nobody else stores. **Keep private** when profiles go public |
| `title_credits.job` | `'Director'` makes collection progress a local query — no API call, and the full-length-film rule becomes affordable |

---

## What this unlocks that we couldn't do before

- **Collection progress is local.** "6 of 11 directed" is a question to our own database. And since runtime is cached, the denominator can use *released feature-length films* — the rule that doesn't drift — instead of the vote threshold.
- **The library renders offline**, as the designs require. It has posters, years and titles without TMDB.
- **`ProfileView`'s N calls disappear.** Fifty saved titles currently means fifty API calls to draw one screen.

---

## Capacity

Free tier is 500 MB.

| | |
|---|---|
| A catalogue title, with credits and indexes | ~3 KB |
| 40 episodes of progress, stacked | ~400 bytes |
| A library entry | ~250 bytes |

**The catalogue plateaus; user data doesn't.** The 10,000th user adds almost no new titles — they're saving the same films as everyone else. Expect 20–40k cached titles even at real scale, well under the ~150k that would fill the tier.

At roughly 1,000 active users: catalogue ~90 MB, libraries ~50 MB, activity ~30 MB. Comfortable.

**Levers, in order:** cap credits at 10 cast + key crew (built in); cap keywords at 15 (built in); drop `overview` — it's half the row, kept only because meaning-based search would need it; prune catalogue rows nobody has saved and nobody's viewed in six months.

A more pressing free-tier fact than size: **projects pause after about a week of inactivity.**

---

## Deliberately not built

Lists, reviews, follows, public profiles, embeddings, and engagement tracking (impressions, searches, result clicks).

All are **additions** — new tables alongside these six. Nothing here needs unpicking.

**One accepted consequence:** learning only from what people save means there's no negative signal — what someone scrolled past leaves no trace. Good enough for a first model, and the same approach Letterboxd's own taste features take.

---

## Migration notes

- `profiles` is **altered, never dropped**, so any signup trigger on it keeps working. The script opens with a query to check for one.
- `user_movies` and `user_episodes` are **dropped**. All existing data is lost — agreed, as it's experimental.
- `user_episodes` couldn't have been kept regardless: it had no column recording which show an episode belonged to.
- The app code needs updating alongside — `userApi.js` writes `status: 'wishlist'`, which no longer exists.

---

## Why `catalog_people` and `catalog_credits` are separate from `catalog_titles`

The alternative is storing cast and crew inline on the title — `catalog_titles.cast` as a JSON blob. That works for exactly one question and breaks the rest.

| Question | Inline on the title | Separate tables |
|---|---|---|
| "Who made Dune?" | ✅ Read the row | ✅ |
| "What else did Villeneuve direct?" | ❌ Scan every title, search inside each blob | ✅ Indexed lookup |
| "Search for a person" | ❌ No list of people exists to search | ✅ One small table, one text index |
| "How many Villeneuve films has Raman seen?" | ❌ Full catalogue scan | ✅ Join credits to library |

So yes — **it powers exactly the features you described**: the person page, person search, and collection progress. Those are three committed MVP features (designs R5, R6, R20, R21), not future speculation.

Two further reasons:

**A biography has nowhere else to live.** The person page shows a bio, birthday and place of birth. Those belong to the *person*, not to any one credit. Without `catalog_people` there is no row to put them on.

**It's the Blade Runner principle, applied to people.** Inline, Villeneuve's name, photo and biography would be repeated inside all 26 of his titles. One row for the person, many credit rows pointing at it — the same deduplication you asked for on titles.

**Why two tables and not one?** A credit is a *relationship* — "Zendaya played Chani in Dune, billed second". That fact belongs to neither the person alone nor the title alone. Collapsing them would repeat every person's details on every credit row.

---

## How big `user_activity` gets

This is the only table that grows forever, so it's the one with a plan.

**A row costs ~220 bytes** — 130 of data plus ~90 of index.

Per active user, per year, roughly:

| | |
|---|---|
| ~100 titles added, status-changed and rated | ~300 rows |
| ~300 episodes, logged in batches of three | ~100 rows |
| **Total** | **~400 rows ≈ 100 KB per user per year** |

| Scale | One year | Three years |
|---|---|---|
| 100 active users | 10 MB | 30 MB |
| 1,000 active users | 100 MB | 300 MB |

So it's free for a long time and becomes the largest table somewhere around **500 active users**. Plan the prune before then, not now.

### The five things keeping it small

1. **Batching.** "Episodes 21–25" is one row, not five. Without this, episode logging alone would be five times bigger — and it's how people actually log anyway.
2. **Collapsing.** Repeated edits to the same title within five minutes replace the previous row instead of adding one. Someone nudging a rating from 7 to 7.5 to 8 while deciding writes **one** row, not three.
3. **Six types only.** No views, no searches, no scrolling. Only things a person would recognise as something they did.
4. **A tiny `detail` field.** A few keys, no nesting, and never the title text — that lives in the catalogue and would otherwise be duplicated on every row.
5. **Retention.** Keep roughly twelve months live once there are real users. The feed only ever shows recent activity, and the durable signal — when someone started and finished something — is already on the library row, so pruning old activity loses nothing that matters.

If it ever outgrows that, Postgres partitioning by month is the standard next step. Not needed at this scale.
