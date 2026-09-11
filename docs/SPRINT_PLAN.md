# Cine Search — Phase 1 Sprint Plan

**Goal:** a committed search-quality baseline, one shipped fix, and a measured delta.
**Rollback point:** git tag `baseline-v0`
**Runtime kill switch:** `VITE_SEARCH_V2` (default `false` = current behaviour)

---

## What gets built

### Step 0 — Auth cold-start fix
- `src/views/AuthPage.jsx` — timeout 4s -> 20s; show "waking up database..." at 3s instead of erroring
- `api/keepalive.js` + `vercel.json` cron — daily ping so the project never sleeps

### Step 1 — Safety scaffolding
- `src/lib/searchFlags.js` — reads `VITE_SEARCH_V2`, defaults false
- `src/hooks/useMovieSearch.js` — routes to v1 or v2; v1 path untouched

### Step 2 — Eval harness
```
/eval
  run.mjs            npm run eval
  lib/metrics.mjs    null-and-low@5, zero-result, P@5, MRR, coverage@10
  lib/report.mjs     console table + JSON writer
  lib/cache.mjs      TMDB response cache (reproducible runs)
  runs/              timestamped results, committed
  .cache/            gitignored
```
Runner: `vite-node` so the harness imports the real `src/lib/tmdb.js` unmodified.

### Step 3 — Golden query set
- `eval/queries.json` — 120 queries, brief's category weights
- Known-item categories auto-keyed; open-set left for labelling

### Step 4 — Labelling tool
- `eval/label.html` — posters, Y/N keyboard shortcuts, resume support, JSON export
- Candidates drawn from a **wider** retrieval than the baseline (anti-circularity)

### Step 5 — Baseline run (committed before any fix)

### Step 6 — Phase 2, behind the flag
```
/src/lib/search/
  normalize.js   lowercase, diacritics, transliteration
  extract.js     year / genre / language / modifier lists
  retrievers.js  fan-out: title index, /search/multi, /search/person, keywords
  fuse.js        reciprocal rank fusion
  rerank.js      weighted score, profile from extract
  ladder.js      zero-result recovery cascade
```

### Step 7 — Re-run, diff, surface regressions loudly

---

## Metrics

| Metric | Applies to | Why |
|---|---|---|
| **null-and-low@5** (headline) | all | zero results OR nothing acceptable in top 5; immune to fallback gaming |
| zero-result rate | all | diagnostic split: empty vs populated-but-wrong |
| Precision@5 | all | how much of the top 5 is acceptable |
| MRR | known-item only | meaningless where many answers are acceptable |
| coverage@10 | open-set | share of labelled acceptable titles found; NOT recall |
| catalogue-gap rate | reported separately | queries with no valid TMDB answer, excluded from scoring |

Categories with n<15 are flagged **directional only**.

---

## Known limitations (for the PRD)

- Single labeller; no inter-rater agreement
- TMDB catalogue skews Hollywood; Indian-language metadata is thin
- Offline eval only; no click data, no online validation
- No personalisation (no user base)
