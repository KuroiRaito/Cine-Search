# How the golden set was labelled

`queries.json` holds 120 queries. All 120 now carry `expected` labels.

| Source | n | Meaning |
|---|---|---|
| `auto` | 50 | The original pass. Known-item queries resolved from `intended` to a TMDB id. |
| `claude-rule-2026-09-18` | 51 | Generated from a **predicate**, recorded per query in `label_rule`. |
| `claude-judgement-2026-09-18` | 19 | Hand-picked, because no predicate produced a defensible answer. |

## Why two methods

Most open-set queries have an objective answer set:

- **franchise** → the TMDB collection's parts, in release order. Exact.
- **person_led** → that person's own credits in their primary department, ordered by vote count.
- **hinglish / attribute** → a `/discover` predicate: language, genre, decade, runtime.

Those are rules, and a rule can be re-run and argued with. Grades follow rank:
the top 5 are grade 3, the next 5 grade 2, the next 10 grade 1. A collection's
parts are all grade 3 — no part of a franchise is a worse answer than another.

**Mood is not a rule.** The predicate was tried first and produced labels that
were simply wrong: `Comedy|Family, rated 7+, most voted` answered *"feel good
movie"* with **Pulp Fiction** and *"uplifting movie"* with **Fight Club**,
because sorting any genre band by vote count returns the same famous films. The
19 queries in the judgement bucket are hand-picked, each with its reasoning in
`label_rule`, and they are **the ones to review first** — they encode taste, and
the taste is mine rather than the product's.

## Two traps found while labelling

- **`/search/movie?year=` does not outrank relevance.** `query=Queen&year=2013`
  returns *Queen Margot* (1994) first. Use `primary_release_year`, and verify the
  year of what comes back rather than trusting the parameter.
- **`/search/collection` is the fallback, not the primary.** Three collections —
  Bāhubali, Dhoom, Golmaal — are not reachable from their top film's
  `belongs_to_collection`, and two others rank junk first from collection search.
  Try the film first, fall back to the collection search.

## Running it

```
npm run eval -- --variant v1-baseline
npm run eval -- --variant v2
```

Needs `TMDB_API_KEY`. **If detection fails the harness falls back to proxy mode,
which cannot work from a script** — the deployed proxy refuses requests with no
Origin header, so all 120 queries return 403 and the run scores nothing. It
reports this loudly rather than scoring zeros, which is correct; a run that
reports `tmdb_mode: proxy` should be thrown away and repeated.
