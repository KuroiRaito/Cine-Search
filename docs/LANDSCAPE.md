# Cine Search — Competitive Landscape

**Owner:** Raman Malani
**Written:** 2026-09-14
**Status:** Grooming input. Not a blocker on any open AC.
**Supersedes:** nothing. This is the first written competitive scan on the project.

---

## 0. Why this document exists, and why it didn't before

The analysis had already happened. On 2026-09-13, in this worktree, the market was
characterised in conversation as:

> The market is oddly split: **Letterboxd** — film only, excellent community, deliberately
> no TV. **TV Time** — TV only, real community. **Simkl** — tracks everything, not loved by
> anyone in particular. Nobody convincingly owns *"both movies and TV, with a real community,
> that people enjoy using."*

That framing is broadly right and it shaped the concept. It was never written down, so:

1. **It could not be checked.** TV Time — one of the three pillars of that claim — had already
   shut down on 2026-07-15, eight weeks before it was cited as a live competitor.
2. **It could not be extended.** Moctale, a direct India-focused player, surfaced only when the
   owner found it independently on 2026-09-14.
3. **It could not be argued with.** A claim in a chat log is not a claim the project can be
   held to.

**The process lesson, worth more than any row in the table below:** market findings that live
only in conversation decay silently and are indistinguishable from findings that were never
made. This is the fix, not the finding.

---

## 1. How to read this

The spine is Cine Search's own layer model from [`CONCEPT.md §6`](CONCEPT.md), plus the two
axes that model doesn't cover — streaming availability, and Indian-language depth.

| | meaning |
|---|---|
| **L0 — Record** | watch states, episode-level progress, ratings, a browsable directory |
| **L1 — Catalogue** | detail pages with cast, crew, connections; search |
| **L2 — Collection & taste** | filmography completion, canons, auto-derived taste profile |
| **L3 — Standing** | public profiles, published reviews, shareable lists |
| **L4 — Social** | follows, feed, replies, likes |
| **OTT** | where-to-watch, India specifically |
| **IN** | Indian regional-language depth beyond Hindi |

`Y` = does it well · `~` = partial or paywalled · `—` = absent

---

## 2. The matrix

| Player | L0 | L1 | L2 | L3 | L4 | OTT | IN | Note |
|---|---|---|---|---|---|---|---|---|
| **Letterboxd** | ~ | Y | ~ | Y | Y | ~ | ~ | Film only. No TV, by design. ~28–30M users. |
| **Serializd** | Y | ~ | — | Y | Y | — | ~ | TV only. The mirror image of Letterboxd. Free. |
| **Trakt** | Y | ~ | — | — | — | ~ | — | Substrate, not product. Free tier squeezed hard in 2026. |
| **Simkl** | Y | ~ | — | ~ | ~ | ~ | — | Widest coverage: film + TV + anime. Thin community. |
| **Moctale** | ~ | ~ | — | Y | Y | Y | Y | India-first. Podcast-owned audience. See §4. |
| **IMDb** | ~ | Y | — | ~ | — | ~ | Y | Watchlist + ratings. Trivia moat. No collection sense. |
| **TMDB** | — | Y | — | — | — | ~ | ~ | Our data source. Community-edited. Not a consumer product. |
| **JustWatch** | — | ~ | — | — | — | Y | Y | Availability only. Best-in-class at it. |
| **Moviebase** | Y | ~ | — | — | — | ~ | — | TMDB-powered, Trakt sync. Ad-supported. |
| **Cinopsys** | Y | ~ | — | — | — | ~ | — | Free, ad-free, local-first. Trakt + Simkl sync. |
| **AniList / MAL** | Y | Y | ~ | Y | Y | — | — | Anime only. The structural proof the full stack works. |
| **Douban** | Y | Y | ~ | Y | Y | — | — | China only. The proof an "everything" platform can exist. |
| **TV Time** | — | — | — | — | — | — | — | **Dead.** Shut down 2026-07-15. 25M members. |

Confidence: high on Letterboxd, Trakt, Simkl, JustWatch, TMDB, TV Time. Moderate on
Moctale (store listings only, no hands-on). Low on the indie trackers' current feature depth —
much of the public comparison writing about them is published by rival trackers' own blogs and
should be treated as marketing.

---

## 3. What the market actually shows

**The split is real, and the thesis holds — with one correction.** Nobody owns "movies and TV,
with a real community, that people enjoy using." Letterboxd refuses TV. Serializd refuses film.
Trakt refuses to be a product. Simkl does the union of everything and is loved by nobody, which
is the most instructive data point in the table: **breadth alone has already been tried and it
does not produce affection.** Coverage is not the moat. The correction to the original framing
is that "caters everything" is not the unmet need — Simkl caters everything.

**A 25-million-member hole opened two months ago.** TV Time shut down on 2026-07-15 and deleted
every account's watch history. Those users are currently redistributing across Serializd, Simkl,
Moviebase and Cinopsys. This is the single largest market event in the category in years, it
happened during this project's concept phase, and no project document registered it.

**The category's economics are visibly tightening.** Trakt doubled VIP pricing and capped free
accounts to 100 watchlist items and one connected app. Whip Media closed a 25M-user product as
unsustainable. Letterboxd — majority-acquired by Tiny in 2023 — has been
reported to be exploring a sale, though only via low-quality aggregators; treat that one as
unconfirmed. This is a category where attention is easy and revenue is hard — relevant context for a project with no monetisation model and, per
[`CONCEPT.md §6`](CONCEPT.md), no planned rollout.

**Two markets prove the full-stack model works — both by owning a language or a culture.**
Douban is IMDb, Goodreads and a forum network in one interface, and is the canonical source for
Chinese consumer taste. AniList and MyAnimeList do the same for anime, and AL-chan — this
project's declared reference in [`CONCEPT.md §11`](CONCEPT.md) — exists only because AniList
built that substrate first. Neither won on feature breadth. Both won a bounded culture.

**India is under-served but not unclaimed.** Letterboxd has real Indian traction and has run
editorial on Indian cinema; India is among its larger markets. What's genuinely missing is
regional-language depth — Tamil, Telugu, Malayalam, Kannada, Bengali and Marathi cinema as
first-class, not as TMDB rows with English metadata. That gap is already named as a constraint
in [`BRIEF.md §3`](BRIEF.md) and it is the same gap Moctale is aiming at.

---

## 4. Moctale, specifically

Built by Men of Culture Media Pvt Ltd — the Indian film podcast. Announced August 2025, shipped
on iOS and Android.

- Ratings via a **"Moctale Meter"**: Perfection / Go For It / Timepass / Skip It. Tags, not stars.
- Follow friends, community recommendations, mood and genre collections, release tracking.
- Discovery across OTT platforms *and theatres* — theatrical is a real India-specific choice.
- ~4.5 stars from ~180 India App Store ratings; ranked around #23 in Entertainment there.

**Scale — small, and worth being precise about.** Google Play shows **50K+ installs**, which is a
bucket meaning 50,000–100,000, not a measurement. AppBrain estimates ~18K, but against a
*different package id* (`com.lsoys.moctale` vs the live `moctale.android.app`), which suggests a
republish and makes that figure unreliable. On iOS, ~180 ratings implies roughly 10–20K installs
at typical rating rates. **Best read: tens of thousands of total installs, concentrated in India,
driven by a podcast launch spike rather than demonstrated organic growth.** Real, early, and not
yet proof of anything durable.

**What it validates:** Indian-language-first film community demand is real and someone is
serving it.

**What it does not validate:** anything Cine Search is currently building. Moctale's feature
list is L3 and L4 — opinions, follows, community. It has no filmography completion, no episode
progress, no taste profile. It went at the layers this project
[parked on 2026-09-13](CONCEPT.md); it has nothing in the layers this project kept.

**The uncomfortable part:** the stated reason for parking L3/L4 was cold start — "a public
profile with nobody reading it advertises that the room is empty." Moctale did not solve that
with product. It arrived with a podcast audience already assembled. That is a distribution
answer to a distribution problem, and it is not available to us. The park decision therefore
looks *more* correct after this scan, not less — but for a sharper reason than the one written
down: we parked the layers that require distribution we do not have.

### Moctale usage — measured, 2026-09-14

No MAU or DAU is published. Private company, no press disclosure. The closest available
measurements, with their confidence:

| Signal | Value | Source quality |
|---|---|---|
| Monthly visits (Jul 2026) | **1.33M**, +7% MoM from 1.24M | Semrush estimate — directional |
| Pages / visit | 7.14 | Semrush |
| Avg session | **6m 42s** | Semrush |
| Bounce rate | 28.5% | Semrush |
| India share | 89.9% | Semrush |
| Traffic mix | **82.5% direct**, 13.2% Google | Semrush |
| Organic search traffic | **15.07K/mo** | Semrush |
| Referring domains | **31** (83 backlinks) | Semrush |
| Registered users | ~100K by late 2025 | Weak — single aggregator source |
| Play installs | 50K+ bucket | Store |
| Distribution asset | MoC podcast 255K subs; hosts ~4M combined | Public channel data |

**Derived MAU — stated as a range, not a number.** 1.33M visits at plausible return rates for a
community site implies roughly **150K–400K monthly actives**, with registered accounts likely in
the low hundreds of thousands. **DAU is not derivable from public data.** Anyone quoting one is
guessing.

**The number that actually matters is 15.07K organic search traffic against 31 referring
domains.** Their top organic keyword is *"moctail"* — a misspelling of their own brand — carrying
91% of organic traffic. **Nobody arrives at Moctale by searching for a film tracker.** Combined
with 82.5% direct traffic, this says something precise:

> Moctale has demonstrated **audience transfer**, not product-market fit. It converted a ~4M-subscriber
> creator network into ~100K registered users — a normal-to-good creator→product conversion — and has
> built essentially no independent acquisition engine on top of it.

Engagement, by contrast, is genuinely strong: 6m42s sessions, 7.14 pages, 28.5% bounce. People who
arrive do stay. **The product is sticky; it just isn't discoverable.** And +7% MoM is healthy but
not viral — consistent with a community approaching saturation of its source audience.

---

## 5. The long tail — everyone else

Moctale is not an outlier; it's one of a crowded field. Scanned 2026-09-14. Install figures are
Play Store buckets or vendor claims, not measurements.

### India — adjacent, but not competing on the same axis

| Player | Who | Scale | What it is |
|---|---|---|---|
| **OTTplay** | HT Labs (HT Media), 2020 | Corporate-backed | 30+ OTT platforms, 50k+ titles, editorial reviews, mood/language recommendations, subscription bundles |
| **Flixjini** | Cheeni Labs, Chennai | 100K+ installs, 4.1★ | Search/filter across OTT, a "queue" watchlist, WhatsApp sharing |
| **Binged** | — | — | OTT release tracking and dates |

**The finding that matters: India's field is OTT-aggregator shaped, not community shaped.** These
answer *"what should I watch tonight, and where is it."* None answers *"what have I watched, and
who does that make me."* Moctale is close to alone in India on the community axis — which makes
it both a validation and, if it works, the incumbent to displace.

### Global indie trackers — the commoditised middle

| Player | Model | Notable |
|---|---|---|
| **Must** (Likewise Inc.) | Free, 250K+ installs, 4.7★ | "Must Match" — taste similarity against users who rate like you. Activity feed, public profile URLs. The closest thing to a shipped taste profile. |
| **Limelight** | Free, no ads, iOS/Mac | **Cast and crew profiles with full filmography.** Where-to-watch, aggregated RT/IMDb/Metacritic/TMDB ratings. |
| **Hobi** | Free + paid, Trakt two-way | Diary timeline, episode countdowns, release alerts |
| **Moviebase** | Ad-supported + premium, Android | TMDB-powered, Trakt two-way sync, stats |
| **Cinopsys** | Free, ad-free, local-first | Works with no account; Trakt + Simkl sync; Drive backup |
| **Achriom** | Free tier, $9.99/mo Pro | AI librarian across film, TV, books, music, anime, podcasts, games. **Explicitly no social feed, no followers.** |
| **FlickFocus** | Freemium, iOS/Android | Watchlist + awards-season features |
| **Cineswipe** | — | Swipe-based discovery with AI |
| **TasteRay** | — | Recommendation-first; picks rather than conversation |
| **flickd / Movra / Listy** | — | Long-tail trackers, thin public detail |

### Three things this tail actually tells us

**1. The stack is commoditised, and it is our stack.** Almost every app above is TMDB metadata
plus Trakt or Simkl sync. That is precisely Cine Search's architecture. **Differentiation cannot
come from the stack, because the stack is free and everyone has it.** The only defensible
positions left are the data nobody else stores and the culture nobody else serves.

**2. Two small players are already inside the wedge.** Limelight ships **full filmography on cast
and crew profiles**. Must ships **taste-matching against similar users**. Neither ships the
completion denominator — "8 of 10" — but the claim in [`CONCEPT.md:77`](CONCEPT.md) that this is
ground "almost nobody ships well" is doing more work than the evidence supports. The unclaimed
ground is narrow and specific: *a computed filmography denominator with a defensible inclusion
policy.* Not "collecting creators" in general.

**3. The market is bifurcating, and the middle is empty for a reason.** One pole is big social —
Letterboxd, Serializd, Moctale. The other is private utility — Cinopsys, Achriom, Limelight, with
Achriom marketing "no social feed, no followers" as a *feature*. Cine Search as currently scoped
(L0–L2, social parked) sits in the private-utility pole while its concept document describes a
Cinephile persona whose stated need is *"feel superior socially."* That is a real tension between
[`CONCEPT.md §3`](CONCEPT.md) and the 2026-09-13 scope decision, and it is worth naming rather
than leaving implicit.

---

## 6. Where Cine Search actually sits

**The wedge in [`CONCEPT.md:77`](CONCEPT.md) — "I've seen 8 of 10 Tarantino" — survives, but by
a narrower margin than that line claims.**

Nothing in the table ships filmography-denominator completion as a first-class unit. But
Letterboxd Pro/Patron is closer than assumed: it ships most-watched directors and actors, and
**progress against milestone lists**. That is list-completion, not filmography-completion — a
curated denominator rather than a computed one — but it occupies adjacent ground and it is
already monetised. Limelight organises by director filmography. The idea is not unthought-of;
it is unshipped as a denominator.

Which makes the open ruling [`GROOMING.md B1`](GROOMING.md) — *"the collection denominator is a
policy, and the cheap options are narrower than they look"* — the most commercially significant
open question on the project. The denominator **is** the differentiator. If it resolves to a
curated list, Cine Search is building a worse Letterboxd milestone feature. If it resolves to a
computed, credited filmography with a defensible inclusion policy, it is building something
nobody ships.

**Honest risk to the "nothing caters everything" thesis:** the reason nothing caters everything
may be that the bundle is not what users want. Letterboxd's refusal to add TV is a fifteen-year
deliberate product position held while growing to ~30M users, not an oversight. Simkl caters
everything and is, by common account, loved by nobody. "Nobody has done X" is evidence of
opportunity only when you can also say why the people who could have done X chose not to. This
project has not yet answered that, and should not treat breadth as the differentiator until it
can.

---

## 7. What this changes

**Nothing about scope, and nothing about the current build order.** No AC changes. No design
changes. The L3/L4 park stands and is better justified than before.

**Three rulings for grooming:**

- **L1. Does a competitor proving demand for L3 change the park?** Recommended answer: no.
  Moctale's L3 works because of an owned audience. Record the reasoning in `CONCEPT.md` so the
  park rests on distribution, not on a general claim that social is premature.
- **L2. Is the denominator computed or curated?** This is `GROOMING.md B1`, re-scoped upward —
  it is no longer only a data-modelling question, it is the differentiation question. Resolve
  it deliberately.
- **L3. Does regional-language depth enter scope, or is it documented as out?** `BRIEF.md §3`
  names TMDB's thin Indian coverage as a sandbox limitation. Moctale makes it a competitive
  axis. Pick one and write it down.

- **L4. Which pole are we in?** The build is private-utility shaped; the Cinephile persona is
  social-pole shaped. Either the persona's *leaves if* is knowingly unmet in this scope, or the
  scope is wrong. Say which in `CONCEPT.md`.

**One process change:** market findings get written here on the day they're made, or they
don't count.

---

## Sources

Scanned 2026-09-14. Store listings and vendor comparison blogs are marketing material and are
treated as claims, not facts.

- TV Time shutdown — [TechCrunch, 2026-07-02](https://techcrunch.com/2026/07/02/popular-tv-tracking-app-tv-time-is-shutting-down-as-company-focuses-on-ai/) · [Whip Media support notice](https://whipmedia.freshdesk.com/support/solutions/articles/68000029988-tv-time-is-shutting-down)
- Letterboxd scale and sale — [Variety](https://variety.com/vip/letterboxd-year-end-report-growth-1236277320/) · [TIME100 Most Influential Companies 2026](https://time.com/collection/time100-most-influential-companies/2026/letterboxd/) · [Wikipedia](https://en.wikipedia.org/wiki/Letterboxd)
- Letterboxd stats features — [Letterboxd Journal: all-time stats](https://letterboxd.com/journal/all-time/) · [Stats for Lists](https://letterboxd.com/journal/hit-list-new-stats-for-lists-feature/)
- Trakt pricing and free-tier limits — [AlternativeTo, VIP price change](https://alternativeto.net/news/2025/5/trakt-announces-all-vip-renewals-will-switch-to-a-new-standard-rate-doubling-prices/) · [Trakt one-app limit](https://troypoint.com/trakt-limits-users-to-one-connection/)
- Simkl tiers — [Simkl VIP](https://simkl.com/vip/) · [Simkl vs Trakt](https://docs.simkl.org/how-to-use-simkl/faq/frequently-asked-questions/simkl-alternatives/simkl-vs-trakt)
- Serializd — [serializd.com](https://www.serializd.com/) · [Google Play](https://play.google.com/store/apps/details?id=com.serializdmobile&hl=en_US)
- Moctale traffic — [Semrush moctale.in overview](https://www.semrush.com/website/moctale.in/overview/) · Men of Culture — [YouTube channel](https://www.youtube.com/@menofculturepodcast) · [Playboard analytics](https://playboard.co/en/channel/UC9CROGyC9hgIB1mnBuMpeoQ)
- Moctale — [India App Store](https://apps.apple.com/in/app/moctale/id6782066491) · [Google Play](https://play.google.com/store/apps/details?id=moctale.android.app&hl=en) · [Men of Culture announcement](https://www.youtube.com/watch?v=05LzDvxMT5w)
- Moviebase — [Google Play](https://play.google.com/store/apps/details?id=com.moviebase&hl=en_US) · Cinopsys — [cinopsysapp.com](https://cinopsysapp.com/)
- OTTplay — [Google Play](https://play.google.com/store/apps/details?id=com.ht.ottplay&hl=en_IN) · [CB Insights profile](https://www.cbinsights.com/company/ottplay-premium) · Flixjini — [YourStory App Fridays](https://yourstory.com/2020/06/app-netflix-amazon-prime-video-search-track-filter-ott-content)
- Must — [App Store](https://apps.apple.com/us/app/must-for-movies-tv/id1071382493) · [mustapp.com](https://mustapp.com/) · Limelight — [thelimelight.app](https://www.thelimelight.app/) · Hobi — [App Store](https://apps.apple.com/us/app/hobi-tv-shows-tracker-trakt/id1387915223) · Achriom — [achriom.com](https://www.achriom.com/movie-tracker/) · FlickFocus — [App Store](https://apps.apple.com/us/app/movie-tracker-flickfocus/id6475839042)
- Douban — [Marketing to China overview](https://marketingtochina.com/guide-to-douban-marketing/)
- Letterboxd on Indian cinema — [Spotlight on India](https://letterboxd.com/journal/upcoming-indian-films-in-2024/)
