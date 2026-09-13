# Cine Search — Product Concept

**Owner:** Raman Malani
**Status:** v0.2, 2026-09-12 — concept, architecture and MVP scope finalised. Design stage open.
**Relationship to other docs:** This is the product vision. [`BRIEF.md`](archive/BRIEF.md) is no longer the master plan — it becomes the *search quality workstream* inside this concept. Nothing in it is discarded; its framing as "a portfolio project that happens to have an app attached" is inverted. [`TMDB_CAPABILITIES.md`](TMDB_CAPABILITIES.md) is the verified data inventory behind §13.

> **Reading this as design context?** Start at §14 (what to design), §15 (the decisions to make), §11 (the reference product), and §13 (what data each screen can hold). §1–10 is the product reasoning behind all of it; §12 is the engineering state. This document is self-contained — it assumes no prior conversation.

---

## 1. The pitch

> A place for film and TV enthusiasts to build the collection they're proud of, understand their own taste, go deep on the things they love, and be seen doing it by people with the same vibe.

Owner's words: *"My passion project as a film enthusiast who wants every other film enthusiast to be able to fulfil all his desires about his collection of taste and socialise with same vibe people."*

**How it should feel:** Natural, like home. Never like peer pressure or an obligation. People do it because it's fun, not because a streak told them to.

**The failure condition:** it gets *harder* for any persona to do their one task. Every layer added must keep each persona's core task smooth and discoverable, or the layer is wrong.

---

## 2. The structural fact that shapes everything

AL-chan — the reference for this concept — is a **client**. AniList already owned the accounts, lists, scores, follows, activity and reviews; AL-chan put a better window on them.

TMDB is **a catalogue and nothing more**. No user lists, no progress, no follows, no community.

**So Cine Search cannot be a client. It has to be the platform and the client at once.** Every piece of user-generated state — records, collections, opinions, profiles, the social graph — lives in our Supabase. TMDB supplies metadata that hangs off it.

Consequences:
- The data model *is* the product. TMDB is a lookup table.
- Cold start is our problem, not a partner's.
- **Known catalogue gap:** TMDB has cast, crew, keywords, similar titles and videos, but **no trivia or production facts** (that's IMDb's moat). The Hobbyist persona wants exactly that. Either we source it elsewhere, generate it carefully, or scope that persona's expectations honestly.

---

## 3. Who it's for

Five personas, written by the owner. The **leaves if** column is the requirement each one hands us.

| Persona | Wants | Does | Leaves if | Priority |
|---|---|---|---|---|
| **The Cinephile** | Show taste; feel socially superior | Watches widely, maintains a record with deliberate diversity | There's no social validation, and nowhere to post opinions | Core |
| **The Tracker** | Watch a lot; never lose a recommendation | Records what they watched, how many times, and what people suggested | They can't manage or browse their own directory | Core |
| **The Noob** | Find something to watch | Browses the catalogue; reads other people's profiles to get recommendations | Results aren't relevant, or discovery doesn't work | Core |
| **The Hobbyist** | Know things about film | Browses new releases; reads detail pages — plot, creators, cast, similar work, trivia | There's too little information, or it's buried | Core |
| **The Critic** | Be read | Publishes critique on episodes, films, directors, actors | They can't speak freely, or their writing gets no distribution | Later |

Two observations worth resolving:

- **The Noob is filed under *collection*, but every behaviour listed is discovery and social.** Browsing the catalogue and reading other people's profiles isn't collecting. Either the Noob is an aspiring collector (fine, but the *first* need is discovery), or the assignment should move.
- **"Feel superior socially" is the most useful line on the sheet.** Don't sand it off. Letterboxd runs on precisely this. It means public profiles, visible taste, and opinions with an audience — and it means those can't be bolted on at the end.

---

## 4. What the app is emotionally for

The original three-center model doesn't survive contact with the personas, and the owner's own note explains why:

> *"It's supposed to become a habit, but comparing it to a diary is not correct as not everyone watches something daily."*

Correct — and it kills the diary framing. Film is not a daily medium. A daily-logging habit is the wrong engine.

**Revised model: recording is the substrate, not a center.** Nobody opens the app *to record*. They record so that the other things can exist. Four centers sit on top, and every persona maps to one:

| Center | The feeling | Who | Weight |
|---|---|---|---|
| **Collection** | "Eight Tarantino films down, two to go." Progress against a body of work — and against **creators**, not just titles | Cinephile, (Noob, aspirationally) | High |
| **Taste** | "This is who I am as a viewer" — genres, actors, directors | Tracker | High |
| **Knowing** | Depth. Cast, crew, connections, context, trivia | Hobbyist | High |
| **Standing** | Being read, being seen, having an opinion that lands | Cinephile, Critic | High |
| *Recording* | *Substrate — serves all four, owned by none* | — | — |

The owner's weighting (Collection 100, Taste 100, Recording 65) is consistent with this: recording matters, but it scored lower *and drew zero personas*, which is exactly what a substrate looks like.

**Collecting creators is a genuinely differentiating idea.** "I've seen 8 of 10 Tarantino" is a unit almost nobody ships well. Letterboxd doesn't foreground it. That's a wedge.

---

## 5. The conflict: the social layer is not optional

We had agreed to build the social layer last. **The personas say otherwise, and they're the owner's own.**

Three of five leave because of a missing social layer:

- **Cinephile** — leaves if there's "no social validation... or place to post their opinions"
- **Noob** — whose stated daily act is "look at other's profiles to interact to get more recommendations"
- **Critic** — leaves if there's no "discovery for thoughts"

Only the **Tracker** and the **Hobbyist** retain on a single-player app.

So the standard advice — "build the tracker, add community later" — would ship a product that two of the five core personas abandon on contact. The cold-start problem is real, but deferring social wholesale is not the answer.

### The resolution: public profiles before social mechanics

Split "social" into two things that have been wrongly bundled:

1. **Standing** — a public profile: your collection, your taste, your opinions, readable by anyone with the link. This is a **single-player artifact that happens to be social.** It needs no other users to exist, no feed, no graph, no moderation load.
2. **Social mechanics** — follows, activity feeds, likes, comments, notifications. These genuinely need a crowd and should wait.

Ship **1** early. It gives the Cinephile somewhere to post and be seen, gives the Noob someone to read, gives the Critic distribution — and costs almost nothing in cold start, because a profile with one user on it is still a complete object.

Ship **2** once there are enough profiles that a feed has something in it.

---

## 6. Roadmap

Each layer is useful on its own, and each one closes at least one persona's *leaves if*.

### Layer 0 — The record (substrate)
Watch states (planning / watching / completed / dropped / on hold), episode-level progress for TV, ratings, a personal directory that is genuinely browsable and manageable.
**Closes:** Tracker's *"can't manage or browse his own directory."*

### Layer 1 — The catalogue
Rich detail pages: cast, crew, similar work, connections, context. New releases. Search that actually works. This is where the existing search workstream lands.
**Closes:** Hobbyist's *"less information, or hard to discover"*; Noob's *"didn't find relevant results."*
**Open:** trivia and production facts are not in TMDB — decide the source before promising the Hobbyist depth.

### Layer 2 — Collection & taste
Creator collections and filmography progress ("8 of 10 Tarantino"). Canons and user-made lists. The taste profile: genres, directors, actors, decades — built from Layer 0.
**Closes:** Cinephile's record-keeping half. Gives the Tracker a payoff.

### Layer 3 — Standing *(parked)*
Public profiles, published opinions and reviews, shareable collections and lists.
**Closes:** Cinephile's *"no social validation, nowhere to post"*; Critic's *"no discovery for thoughts."*

### Layer 4 — Social mechanics *(parked)*
Follows, activity feed, replies, likes. Only once Layer 3 has produced enough to read.

---

### Scope decision — 2026-09-13: the product ends at Layer 2

**Owner's call:** Layers 3 and 4 are parked indefinitely. Both need a community
to be worth anything, and there is no rollout to users planned. A public profile
with nobody reading it, and a feed with nobody in it, are worse than their own
absence — they advertise that the room is empty.

**The horizon is Layer 2.** Three milestones, all shipped or in flight:

| | Layer | State |
|---|---|---|
| M1 | 1 — The catalogue | shipped |
| M2 | 0 — The record | in review |
| M3 | 2 — Collection & taste | next, and last |

This is not "social later, after M3". It is a different product: a private
instrument for one film enthusiast to record and understand their own watching.
AL-chan remains the reference for *how a tracker should feel*, not for what it
should eventually become.

**What this settles, and what it does not:**

- **Settles.** Nothing a person records is ever published, so private-by-default
  becomes simply private. No public profile route, no username collision
  problem, no moderation, no cross-user RLS policy, no share surface, no
  follower model, no notification system. `user_activity` is a private
  substrate for taste, never a feed anyone reads.
- **Does not settle.** The record stays the record. Layers 3 and 4 were always
  *downstream* of Layer 0, so nothing built for them was built early — parking
  them costs no rework. If the decision reverses, the data is already the right
  shape, and the work is new screens rather than a migration.

The personas whose *leaves if* those layers were to close — the Cinephile's
social half and the Critic — are consciously not served. That is the price, and
it is stated here so nobody rediscovers it as a surprise later.

---

## 7. What this implies for the data model

The Supabase schema is the product. Today `user_movies` holds `user_id, tmdb_id, media_type, title, rating, status` — the seed of Layer 0, with `status` only ever set to `wishlist`.

Needed, roughly in layer order:

- `status` extended to the full lifecycle
- **episode progress** — per user, per show, per season/episode (TMDB supplies the episode lists)
- **watch events** — separate from status, so rewatches and "how many times" are representable (the Tracker asked for this explicitly)
- **recommendation source** — who suggested it (the Tracker records "what people suggested"; no existing tracker does this well)
- **lists** — user-authored, ordered, public or private
- **creator follows / collection targets** — the "8 of 10 Tarantino" unit
- **profiles** — public-readable, with a handle
- **reviews / opinions** — long-form, attached to a title or a person
- **follows + activity** — Layer 4 only

The **recommendation source** field is worth calling out. "Ravi told me to watch this in March" is a real enthusiast need, it's cheap to store, and nobody ships it.

---

## 8. Where the search work fits

Not discarded, not a separate project:

- Search is the **front door of the core loop** — hit constantly while adding titles. Zero-result rate now costs retention, not just a demo metric.
- Discovery ("something light for a Sunday") is the Noob's entire persona, and their stated failure mode.
- The search PRD remains a complete, self-contained interview artifact regardless of what the app becomes around it.

The change: search quality stops being the *point* of the repo and becomes a *load-bearing capability* of a real product. That's a stronger story, not a weaker one.

---

## 9. Open questions — resolved

Answered by the owner, 2026-09-12. These are decisions now, not questions.

1. **Trivia and facts.** Accepted as a phase limitation. Build the best detail page TMDB allows — synopsis, where to watch, cast, crew, related work — and revisit depth when the catalogue is no longer the constraint. *Do not promise the Hobbyist what TMDB can't supply.*
2. **The centers.** The three-bucket framing (diary / collection / taste) was unclear and the personas are the better source of truth. Superseded by the four-center model in §4.
3. **Profile privacy.** Private and self-only for now — a person sees their own profile and nothing else. Following, viewing others, and a public/private toggle arrive with the community layer. **This changes §5:** "standing" ships *later* than argued there; the Cinephile and Critic are knowingly under-served in the MVP, and that's the accepted trade.
4. **The recurring act.** Not our decision to force — frequency is the user's. The obligation is on the UX: logging must never feel tedious, even for someone doing it daily. No streaks, no nudges, no pressure. This follows directly from *"feel like home, not forced down on them."*
5. **Movies and TV in one app.** Yes — one app, one profile, one model, exactly as AL-chan holds anime films and anime series together. `media_type` already carries this in the schema.
6. **Rewatches.** A counter on the record — "how many times" — not a separate event log. Simpler, and it's what the Tracker actually asked for.

## 10. The MVP

The first shippable build, scoped by the decisions above.

**The navigation spine** — the thing being built:

> search → result tile → **title page** (synopsis, where to watch, cast, director, related) → tap a director → **person page** (bio, filmography) → tap one of their works → back to a title page.

That loop is the product. Everything else hangs off it.

**In:** search, title pages, person pages (cast and crew), watch providers, the full watch-state lifecycle, rewatch counter, TV episode progress, a private self-only profile.

**Out:** public profiles, follows, feeds, reviews, stats, creator-collection progress, trivia.

**Serves:** the Hobbyist and the Tracker completely; the Noob partially (discovery without other people's profiles). The Cinephile and Critic wait for the community layer — a known, accepted gap.

---

## 11. The reference product

**AL-chan** (github.com/zend10/AL-chan) is the model. It's an unofficial Android client for AniList — anime and manga tracking with a community layer. What Cine Search wants to be for film and television, AL-chan already is for anime.

**What it does structurally, worth taking:**
- List rows, not poster grids, for anything the user owns: poster thumb left, title and meta right, a progress line pinned to the card's bottom edge, and one inline quick action (`+1 EP`).
- Sections grouped by watch state — "Watching", "Completed" — rather than one undifferentiated list.
- A full-screen detail page: backdrop hero → poster overlapping it → a stat strip (score / favourites / status button) → genre chips → collapsible synopsis → horizontal character rail.
- Progress as a first-class visual: the bottom-edge line is how you read your own library at a glance.

**Its visual register** (relevant to the design system, not binding):
- Neutral charcoal ground (~`#1a1a1a` page, ~`#2e2e2e` cards) — flat, no blue tint, no gradients. Neutral surfaces let poster art carry the colour.
- Cream/gold for titles, primary actions, and star ratings — as an *outlined pill*, not a filled button.
- Ice cyan for progress bars and dividers — state, never decoration.

Notably, that gold/cyan split is the same two-accent rule Projector already defines: **cyan acts, gold rates.**

**What deliberately does not transfer:** the activity feed, likes and comments, and the stats dashboard. Those are AL-chan being a mature community client. They map to Layers 3–4 here, not the MVP.

---

## 12. Build state — architecture, as audited 2026-09-12

**The data layer is in good shape.** Better than [`Architecture audit.md`](archive/Architecture%20audit.md) suggests — that document is stale on two points: Supabase Auth is now real (`getSession` + `onAuthStateChange`, not localStorage), and the API proxy's in-memory cache now LRU-evicts at 500 entries, so the memory leak it flags is fixed.

What's solid:
- `src/lib/tmdb/` cleanly split into transport / endpoints / normalize. The TMDB key never reaches the browser — every call proxies through `/api/tmdb`.
- Search has one plain entry point again (`src/lib/search/index.js` → v1, the shipped TMDB behaviour). No flags, no env var, no URL override. The v1/v2 experiment layer and the `/eval` harness are preserved but out of the app's path, to be returned to later.
- Search request handling correctly aborts in-flight requests, so a slow response can't overwrite a newer one.

**The blocker: there is no routing.** `App.jsx` holds `useState('home' | 'profile')` and opens a modal for detail. `react-router-dom` is not installed. The MVP navigation spine (§10) is a *graph you walk* — title → director → their film → its cast → actor. That breaks four ways on the current shell:

1. No URLs — nothing is linkable, bookmarkable or shareable, which Layer 3 depends on entirely.
2. No browser back. On m-web the back gesture is primary navigation; a modal that swallows it is the most common mobile-web complaint there is.
3. Modals can't nest four levels deep.
4. `App.jsx` prop-drills state to every view. Routes fix this for free — each route fetches its own data. **No state library is needed; a router is.**

**Three smaller gaps on the same path:**
- `getDetails()` fetches no credits for films — only `getTVFullDetails` does. So "tap the director" currently has no director to tap.
- No `/person/{id}` endpoint wrapper exists (only `personCredits`), so there's no bio, photo or birthday.
- No client-side cache — walking title → person → back refetches everything.

**Deferred deliberately:** state libraries, TanStack Query, the v2 search path, list virtualization, and API rate limiting. None block the MVP.

**Open, needs an answer before build:** is Row Level Security enabled on `user_movies`? Private self-only profiles require RLS keyed to `auth.uid()`.

**Guest mode is a standing tax.** Every function in `userApi.js` forks on `guest-local-id` with a parallel localStorage implementation. Once episode progress, rewatch counts and lists land, that's two databases to maintain forever. Recommendation: make guests browse-only — search and read freely, sign up to save.

---

## 13. What the data supports

Full verified inventory in [`TMDB_CAPABILITIES.md`](TMDB_CAPABILITIES.md). Every endpoint there was tested against the live API on 2026-09-12. Summary for design purposes:

- **Title page:** one call returns synopsis, runtime, budget, full cast *and* crew, watch providers across 65 regions including India (stream / rent / buy), similar *and* recommendations, thematic keywords, trailers, and certification.
- **Person page:** biography, birthday, place of birth, photo, and full filmography across film and TV. Filtering crew credits on `job == "Director"` returns a complete directed filmography — verified, 15 films for Tarantino. The "8 of 10 Tarantino" collection unit needs no workaround.
- **Series:** seasons, episode counts, per-episode names, air dates, stills and ratings. Episode progress is fully supported.
- **A browsable home, free:** trending, now playing by region, upcoming, TV on air. None require a query — the home screen need never be an empty search box.
- **`discover` is a query engine:** filters on cast, crew, company, keyword, runtime and streaming provider by region. This means **every fact on a title page can become a link** — tap a keyword, get thematically similar films.
- **The one gap:** anecdotal trivia isn't in TMDB. Verified workaround — `external_ids.wikidata_id` → Wikidata → Wikipedia REST summary returns real article text. No key, no cost, proxyable.

**Design implication:** no screen in §14 needs data we don't have. Design to the inventory, not around it.

---

## 14. MVP screen inventory — mobile web first

Order of delivery: **m-web → desktop breakpoints → native app.** The app is last; nothing ships natively until m-web is right.

| # | Screen | Serves | The decision it forces |
|---|---|---|---|
| 1 | Home / Discover | Noob, Hobbyist | Content rails vs. a search-first blank screen |
| 2 | Search results | All | Poster grid vs. list rows; where filters live at 375px |
| 3 | Title page — film | All | Where status / rating / rewatch controls sit |
| 4 | Title page — series | Series tracking | The episode-progress interaction — our `+1 EP` |
| 5 | Person page | Hobbyist, Cinephile | Filmography grouping: as director vs. as cast |
| 6 | My profile (private) | Tracker | How four watch-states are browsed on a phone |
| 7 | Auth + username setup | — | Restyle only; already exists |
| 8 | Global shell | All | Bottom tab bar vs. top bar |
| — | States | All | Loading, empty, error, no results |

---

## 15. Open design decisions

**These are the brief for the design-system work.** Each one changes multiple screens, so they're worth settling before layouts are finalised.

1. **Navigation pattern.** Bottom tab bar reads app-like and matches AL-chan, but on m-web it competes with browser chrome and costs viewport height. A top bar is more honest for web and less familiar for a tracker. This shapes every other screen — settle it first.
2. **Result density.** Poster grids are more attractive; list rows have room for state, progress, and where-to-watch. The Tracker's *"can't manage or browse his own directory"* argues for rows in the library; search results may differ from library.
3. **The tracking control.** AL-chan uses an outlined gold pill inside a stat strip. Where does ours live on a 375px screen — inline in the page, or pinned to the viewport?
4. **Episode progress.** The most habit-forming interaction in the product. Worth designing deliberately rather than inheriting `+1 EP` unexamined.
5. **Styling technology** — still undecided (CSS Modules / Tailwind / CSS-in-JS). Does not block design work, since tokens are plain CSS variables under every option, but must be settled before build.

**The constraint every design answers to:** *"feel natural, like home — never forced."* No streaks, no nudges, no pressure mechanics. And the stated failure condition: **if a layer makes any persona's core task harder, the layer is wrong.**

---

## 16. Process and current status

Working model — a proper lifecycle, not continuous drift:

| Stage | Status |
|---|---|
| Concept & personas | ✅ Done — §1–10 |
| Architecture review + POC | ✅ Done — §12, §13 |
| **Design** | ⬅ **Current.** Design system to be benchmarked and finalised separately, using this document as context |
| Grooming | Pending — designs reviewed and refined against §14 and §15 |
| Development | Pending — acceptance criteria defined by the owner, per screen |
| Test & iterate | Pending |

**Existing design-system draft:** "Projector" v0.1 — https://claude.ai/code/artifact/52322be4-c220-474a-8da8-52dee13f91a7 — tokens, type scale, spacing, a live primitive library, dark default with light as a semantic remap. **Not finalised.** It's a starting point for the design work, not a constraint on it.

**No further development happens until grooming closes.**
