# What we can build with TMDB

Inventory of the data actually available to us, mapped to MVP features.
**Every response in this document was verified against the live API on 2026-09-12.** Nothing here is assumed.

---

## 1. Title page — one call returns everything

```
/movie/{id}?append_to_response=credits,watch/providers,similar,recommendations,keywords,videos,external_ids,release_dates
```

| Field | Use |
|---|---|
| `overview`, `tagline`, `runtime`, `status` | Synopsis block |
| `budget`, `revenue`, `origin_country`, `spoken_languages` | Facts strip |
| `genres` | Chips → genre browse |
| `belongs_to_collection` | **Franchise page** — sequels and prequels as one set |
| `production_companies` | **Studio page** via `discover?with_companies=` |
| `credits.cast` / `credits.crew` | Cast rail; director, writer, cinematographer |
| `watch/providers` | **65 regions incl. India**: `flatrate` / `rent` / `buy` + JustWatch deep link |
| `similar` + `recommendations` | Two different lists — metadata-similar vs behaviour-based |
| `keywords` | Thematic tags (Pulp Fiction has 16) → see §5 |
| `videos` | Trailers, featurettes, behind-the-scenes (YouTube) |
| `external_ids` | `imdb_id`, `wikidata_id` → see §6 |
| `release_dates` | Certification per country (A / U-A / R) |

Currently `getDetails()` fetches **none** of the appended blocks for movies — only `getTVFullDetails` fetches credits. One parameter fixes it.

## 2. TV — full season and episode data

```
/tv/{id}?append_to_response=aggregate_credits,content_ratings,keywords,similar,external_ids
/tv/{id}/season/{n}
```

Verified on Breaking Bad: **6 seasons, 62 episodes**, `created_by: Vince Gilligan`, **348 aggregate cast members** across the run. Season 1 returns 7 episodes with name, air date, still image, overview and rating (`Pilot`, 2008-01-20).

→ Episode-level progress tracking is fully supported. `aggregate_credits` is the TV-correct call — it spans all seasons, unlike `credits`.

## 3. Person page — fully supported

```
/person/{id}?append_to_response=combined_credits,movie_credits,external_ids,images
```

Returns `biography`, `birthday`, `deathday`, `place_of_birth`, `known_for_department`, `also_known_as`, profile photo.

**Verified:** filtering `movie_credits.crew` on `job == "Director"` returns **15 Tarantino films**. That is the "8 of 10 Tarantino" collection unit — buildable today, no workaround needed.

`combined_credits` spans film and TV, as both cast and crew, so one page serves actors, directors, and writers.

## 4. A browsable home — free, and currently unused

The home screen is an empty search box until you type. These need no query:

| Endpoint | Verified volume |
|---|---|
| `/trending/all/week` | 10,000 |
| `/movie/now_playing?region=IN` | 97 |
| `/movie/upcoming?region=IN` | 58 |
| `/tv/on_the_air` | 1,376 |
| `/tv/airing_today` | 400 |

→ Closes the Hobbyist's *"browses new releases"* and half of the Noob's *"can't discover"*.

## 5. Discover is a query engine — make every fact a link

`/discover/movie` and `/discover/tv` filter on `with_cast`, `with_crew`, `with_people`, `with_companies`, `with_keywords`, `with_genres`, `with_runtime.lte/gte`, `with_original_language`, `with_watch_providers` + `watch_region`, `vote_average.gte`, and release-date ranges.

**Verified:** `discover/movie?with_keywords=10235` ("drug dealer") → **916 titles**.

This is the most underused thing we have. It means **every fact on a title page becomes a destination**:

- keyword chip → other films with that theme
- studio → its catalogue
- actor or director → filmography
- "under 2 hours, on something I pay for" → `with_runtime.lte` + `with_watch_providers`

That last one answers the Household Decider without any new data source.

## 6. The one real gap — and a verified workaround

Anecdotal trivia (IMDb-style "did you know") is not in TMDB.

**Working alternative, tested end to end:**

```
external_ids.wikidata_id   →  Q104123
Wikidata sitelinks         →  enwiki title "Pulp Fiction"
Wikipedia REST summary     →  article extract
```

Returned: *"Pulp Fiction is a 1994 American crime film written and directed by Quentin Tarantino from a story he conceived with Roger Avary…"*

No API key, no cost, CORS-friendly, and proxyable through our existing `/api` route. Two hops, so cache the result. It gives the title page real background and production context.

Later, user-contributed trivia converts this gap into a community feature rather than a licensing problem.

## 7. Known limits — state them, don't design around them silently

- **No anecdotal trivia** → §6 workaround.
- **Indian-language coverage is thinner than Hollywood.** Real, and unchanged from `BRIEF.md`. Affects catalogue depth, not any feature listed here.
- **`similar` is often weak** on lesser-known titles; `recommendations` is usually better. Prefer recommendations, fall back to similar.
- **Attribution is required.** TMDB attribution is already in the README; watch-provider data must additionally credit JustWatch.
