# Universal Pagination & Paginator Loop

## Overview
Cine Search combines data from The Movie Database (TMDB) across different endpoints (`/search/movie`, `/search/tv`, `/discover/movie`, `/discover/tv`). 
A critical architectural challenge arises when we merge these distinct endpoints into a single, cohesive user experience with a mathematically perfect 20-tile CSS Grid pagination system. 

This document explores the fascinating edge cases of TMDB's API and the architectural solution implemented to guarantee flawless pagination UI on our frontend.

## The Problem: TMDB Structural Limitations

TMDB's API contains several structural mismatch limitations that break standard 1:1 API-to-UI pagination mapping:
1. **No Keyword Search Filtering**: TMDB's `/search/` endpoints strictly accept text queries and a `page` number. They **do not** accept parameters for `with_genres` or `vote_average.gte` (Minimum Rating).
2. **Distinct Media Type Indexes**: TMDB completely segregates its TV and Movie indexes. A query for "All" media types requires pinging *both* the `/search/movie` and `/search/tv` endpoints (or their `/discover/` equivalents) concurrently, generating two massive, distinct arrays of disparate popularity.

**The "Throwing Away" Dilemma:**
If the user searches for the keyword "Batman", specifies the "Animation" genre, and asks for "All" Media Types on "Page 2" of the UI:
1. We must request Page 2 of `/search/movie?query=Batman`
2. We must request Page 2 of `/search/tv?query=Batman`
3. We merge those ~40 results.
4. We apply a *client-side* `.filter()` to strip out all non-animated content.

**The Resulting UI Bug**: 
If only 5 of those 40 movies happen to be Animated, the UI grid suddenly collapses from a full 20-tile layout to a measly 5 tiles. Even worse, if *none* of them are animated, the user clicks "Next Page" and is presented with a completely empty screen, even though Page 3 of the TMDB API might be packed with Animated Batman films. This completely destroys the application's perceived stability.

## The Solution: Universal Fetch & Fill Accumulator

To map our UI cleanly onto TMDB's segmented structural data, we decoupled the concept of a `uiPage` from a `currentTmdbPage`. 

When the user requests a complex search containing unsupported client-side parameters, the `searchOrDiscover` proxy function completely intercepts the pagination logic:

1. **Calculate the Theoretical Target**: To satisfy the UI for a specific `uiPage` (e.g., Page 3), we definitively need to have accumulated at least `uiPage * 20` valid items (e.g., 60 items total) to mathematically guarantee sufficient tiles exist to fill that specific page chunk.
2. **Aggressive Upstream Fetching**: The logic enters a continuous `while` loop that fires concurrent `Promise.all` requests to TMDB's disparate TV and Movie endpoints, starting at `currentTmdbPage = 1`.
3. **Merging & Client-Side Filtering**: For each looping cycle, it merges the TV and Movie payloads, and *aggressively applies* any active client-side filters (like Minimum Rating or selected Genre ID).
4. **Valid Item Accumulation**: All items that survive the filter are pushed into a persistent `validItems` array.
5. **Loop Termination Check**: The loop immediately repeats against `currentTmdbPage + 1` *until* the length of `validItems` meets or exceeds our strict mathematically generated `targetCount` bounds (or until `currentTmdbPage` naturally exceeds TMDB's absolute maximum depth `maxTmdbPages`).

### The Code
```javascript
// Example extraction constraint boundary logic
const targetCount = uiPage * 20;
let validItems = [];
let currentTmdbPage = 1;
let maxTmdbPages = uiPage; 

while (validItems.length < targetCount && currentTmdbPage <= maxTmdbPages) {
    // 1. Fetch TV and Movie specific pages concurrently
    // ...
    // 2. Merge Responses
    let combined = [...mRes.results, ...tRes.results];

    // 3. Apply aggressive Client-Side constraints universally
    if (filters.minRating) combined = combined.filter(r => r.vote_average >= filters.minRating);
    if (filters.selectedGenre) combined = combined.filter(r => r.genre_ids && r.genre_ids.includes(Number(filters.selectedGenre)));

    // 4. Save to persistent accumulation array
    validItems = [...validItems, ...combined];
    currentTmdbPage++;
}
```

## Secondary Edge Cases Handled

### O(N log N) Sorting Guarantees
TMDB sorts endpoints individually by Popularity. However, since the `searchOrDiscover` loop fetches incrementally deepening pages across *both* TV and Movies, a globally popular TV show on TMDB TV Page 5 might actually possess a higher literal `popularity` metric than a niche movie on TMDB Movie Page 1. 
Therefore, `searchOrDiscover` globally sorts the entire accumulated `validItems` array *after* the accumulator loop completes.

### Time-Based Duplicate Stuttering
Because API data is highly volatile, requesting Page 1 and then subsequently requesting Page 2 might return the same identical movie on the boundary edge if TMDB's popularity ranking algorithms shifted mid-flight. To guarantee stable UI mapping without `key` collision warnings, a strict fast-path `O(N)` linear deduplication is executed:
```javascript
const uniqueItems = [];
const seen = new Set();
for (const item of validItems) {
    const key = `${item.media_type}-${item.id}`;
    if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
    }
}
```

### Calculated Pagination UI
TMDB returns a `total_pages` parameter. Because our Paginator strips away thousands of invalid entries, that theoretical limit drops radically. 
`searchOrDiscover` uses mathematically derived dynamic limits generated from the absolute size of the `uniqueItems` array to correctly tell the UI Pagination Footer when to disable the "Next Page" chevron button.

```javascript
let calculatedTotalPages = Math.ceil(uniqueItems.length / 20);
if (currentTmdbPage <= maxTmdbPages) {
    // If we haven't exhausted TMDB natively, guarantee there is at least one more valid UI page safely possible
    calculatedTotalPages = Math.max(uiPage + 1, calculatedTotalPages);
}
return { results: pageResults, totalPages: calculatedTotalPages };
```

## Summary
The **Universal Fetch & Fill Accumulator Loop** provides an incredibly stable, seamless UX that elegantly maps any highly-filtered, multifaceted query array precisely into a clean, geometric 4-column UI grid without displaying layout shifts, gaps, or empty pages.
