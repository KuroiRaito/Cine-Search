# Search

Query, results, and the people who match. Screen 2; acceptance criteria M1 §1.3.

## Public surface

```js
import SearchPage from '../modules/search';
import { search } from '../modules/search';   // the only way to run a query
```

`search()` is exported because the eval harness scores it. Which variant
answers — v1, the measured baseline, or v2 — is this module's business.

## What it owns

`lib/` holds the search implementations and the variant seam. `eval/` at the
repository root is this module's test suite: a golden query set, graded
labels, and committed runs.

## Rules it carries

- People rank alongside titles, never above them: they sit after the grid, and
  appear only when the query plausibly names a person (a photo *and* some
  popularity — TMDB finds somebody for almost any string).
- A person row carries collection progress. That is the wedge, surfaced at the
  first possible moment.
- A search that found a person found something: the "nothing for X" empty state
  does not appear above that person's own row.

## Known headroom — the largest of any module

- **Filters and pagination were lost in the Milestone 1 rebuild.** AC 1.3.1,
  1.3.4 and 1.3.6 are open. The design shows All / Films / Series / People
  chips and filters that expand in place.
- No-results should offer a real spelling suggestion. v2 is the seam for typo
  tolerance; the golden set already contains "intersteller", and the measured
  typo score is 95% null-and-low.
- The eval harness scores titles only; the people results are unmeasured.
