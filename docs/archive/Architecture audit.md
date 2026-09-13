# Full Architectural Audit: Cine Search

An in-depth structural and scalability review of the Cine Search application.

---

## 1️⃣ Codebase Structure Audit

**Folder Structure & Component Organization:**
- The codebase follows a standard Vite React layout (`src/{components,hooks,lib,views}`). 
- **Separation of Concerns:** UI components are somewhat tangled with business logic. For example, [HomeView.jsx](file:///Users/a40490/Documents/Cine%20Search/src/views/HomeView.jsx) handles pagination index math, debounce delays, and multi-filter merging.
- **API & Lib Layer:** [lib/tmdb.js](file:///Users/a40490/Documents/Cine%20Search/src/lib/tmdb.js) and [lib/userApi.js](file:///Users/a40490/Documents/Cine%20Search/src/lib/userApi.js) provide a solid abstraction boundary between UI and data fetching.
- **Supabase Patterns:** [userApi.js](file:///Users/a40490/Documents/Cine%20Search/src/lib/userApi.js) provides good service wrappers around the Supabase client.
- **Cross-File Coupling & Reusability:** Hooks like [useMovieSearch](file:///Users/a40490/Documents/Cine%20Search/src/hooks/useMovieSearch.js#4-30) and [useSavedMovies](file:///Users/a40490/Documents/Cine%20Search/src/hooks/useSavedMovies.js#5-61) are well-extracted but highly coupled to specific view behaviors (e.g., eight different dependency parameters in [useMovieSearch](file:///Users/a40490/Documents/Cine%20Search/src/hooks/useMovieSearch.js#4-30)).

**Identified Issues:**
- **Logic inside UI:** [HomeView](file:///Users/a40490/Documents/Cine%20Search/src/views/HomeView.jsx#8-215) is overly responsible for state coordination.
- **Hardcoded assumptions:** Media types and "movie/tv" conditions are scattered and hardcoded throughout components (e.g., [App.jsx](file:///Users/a40490/Documents/Cine%20Search/src/App.jsx), [MovieCard.jsx](file:///Users/a40490/Documents/Cine%20Search/src/components/MovieCard.jsx)).
- **Tight Coupling:** The pagination system heavily couples the UI page size expectations (e.g., 10 vs 20) with the TMDB API wrapper logic.

---

## 2️⃣ Scalability Readiness for Upcoming Pillars

**Evaluation of Future Requirements:**
- **Episode Tracking (`user_episodes`):** Current [MovieCard](file:///Users/a40490/Documents/Cine%20Search/src/components/MovieCard.jsx#1-51) and state assume `movie` or `tv` at a master level. Managing episodes will require a new domain model and deeper nesting that the current flat UI will struggle to support cleanly.
- **Real Authentication (Supabase Auth + RLS):** ❌ **Not Ready.** Currently relies on `localStorage.getItem('user_id')`. This is insecure and completely incompatible with Row Level Security (RLS) policies.
- **Region Persistence:** Currently handled by `useRegion` hook, but not persisted to a user profile in the database.
- **AI Recommendation Layer:** The client-heavy TMDB merging makes AI injection difficult. A backend aggregation service or edge function should be introduced.
- **Social Layer:** Will require significant state overhaul. Passing `savedMovies` down from [App.jsx](file:///Users/a40490/Documents/Cine%20Search/src/App.jsx) to [ProfileView.jsx](file:///Users/a40490/Documents/Cine%20Search/src/views/ProfileView.jsx) as a prop won't scale when you need to load followers' activities.
- **Background Jobs:** Vercel functions (currently used) have strict timeouts. Background availability updates will require a managed queue (e.g., Inngest, Trigger.dev, or Vercel Cron).

---

## 3️⃣ Data Layer Assessment

**Evaluation:**
- **Data Modeling:** `user_movies` uses a logical composite key mapping (`user_id`, `tmdb_id`, `media_type`). 
- **Caching:** TMDB responses are cached in memory in the API layer, but there is no dedicated client-side cache (e.g., React Query / SWR), leading to redundant network calls when toggling views.
- **Overfetching:** [getTVFullDetails](file:///Users/a40490/Documents/Cine%20Search/src/lib/tmdb.js#161-184) fetches TV base details *and* credits simultaneously. 
- **Pagination Strategy:** ⚠️ **Critical Risk.** In [searchOrDiscover](file:///Users/a40490/Documents/Cine%20Search/src/lib/tmdb.js#191-299), the "Unified Fill Path" loops `fetch` requests sequentially to guarantee a fixed UI page size. This is a massive scaling bottleneck.

**Suggestions:**
- **Ideal Data Abstraction:** Migrate to `TanStack Query` (React Query) to handle query invalidation, caching, and loading states, replacing `useEffect` fetching.
- **Service Layer Separation:** Split [lib/tmdb.js](file:///Users/a40490/Documents/Cine%20Search/src/lib/tmdb.js) into modular pieces (`tmdb.search.js`, `tmdb.details.js`) to prevent file bloat.

---

## 4️⃣ API & Proxy Layer Review

**Evaluation ([api/tmdb.js](file:///Users/a40490/Documents/Cine%20Search/api/tmdb.js)):**
- **Security Posture:** Good URL path validation regex (`/^[a-zA-Z0-9/_-]+$/`), protecting against injection.
- **Rate Limiting:** ❌ **None.** The endpoint is exposed directly without API limits, risking TMDB API quotas being drained.
- **Caching Strategy:** Uses Vercel Edge caching (`Cache-Control: s-maxage=60`) which is excellent. However, it also uses a raw JavaScript `Map()` for an in-memory cache. 
- **Memory Leaks:** The `Map()` cache in [api/tmdb.js](file:///Users/a40490/Documents/Cine%20Search/api/tmdb.js) never evicts old entries (it only checks `TTL` on retrieval). In a long-running node process, this will cause an Out-Of-Memory limit crash.

**Improvements:**
- Implement Vercel KV or Upstash Redis for proxy caching.
- Add an API Route Rate Limit middleware.
- Remove the unbounded local memory `Map()` or implement LRU behavior.

---

## 5️⃣ State Management Review

**Evaluation:**
- React local state (`useState` / `useEffect`) is currently used exclusively.
- [App.jsx](file:///Users/a40490/Documents/Cine%20Search/src/App.jsx) acts as a God Component, holding `userId`, `username`, `view`, `region`, and `savedMovies`, drilling them down 3 layers deep.
- **Conclusion:** React state is no longer sufficient.

**Suggestions:**
- **Introduce global state:** Use **Zustand** or **React Context** to manage `UserSession`, `Region`, and potentially `UserLibrary` (wishlist). This completely removes the need to prop-drill [handleSaveMovie](file:///Users/a40490/Documents/Cine%20Search/src/hooks/useSavedMovies.js#19-40) into every sub-component.

---

## 6️⃣ Performance Risks

**Analysis:**
- **Unnecessary re-renders:** [HomeView](file:///Users/a40490/Documents/Cine%20Search/src/views/HomeView.jsx#8-215) manages query, genre, filters, page, and mediaType. When *any* filter keystroke occurs, the entire HomeView re-renders.
- **Heavy Dependency Arrays:** [useMovieSearch](file:///Users/a40490/Documents/Cine%20Search/src/hooks/useMovieSearch.js#4-30) tracks 8 parameters.
- **Missing Memoization:** Extensive object and function creation without `useCallback` or `useMemo` (e.g., [handleProtectedPageChange](file:///Users/a40490/Documents/Cine%20Search/src/views/HomeView.jsx#67-75) recreation).
- **Inefficient List Rendering / Virtualization:** Not currently virtualized. If the user loads a large profile wishlist, rendering 100+ [MovieCard](file:///Users/a40490/Documents/Cine%20Search/src/components/MovieCard.jsx#1-51) elements will cause DOM stutter.

---

## 7️⃣ Recommended Refactor Plan (No Code Yet)

**Proposed Folder Structure for Scaling (Feature-First Domain Model):**
```text
src/
 ├── core/              # Core setup (Supabase client, Vite env)
 ├── domain/            # Business models and static configs
 ├── features/          # Feature-first separation
 │    ├── auth/         # Login, Session context
 │    ├── movies/       # TMDB API wrappers, caches, movie specific hooks
 │    ├── profile/      # User state, wishlist stores
 │    └── search/       # Search logic, filter components
 ├── shared/
 │    ├── components/   # Generic UI (Buttons, Modals, SearchBar)
 │    ├── hooks/        # Generic hooks (useDebounce, useMediaQuery)
 │    └── utils/        # Generic helpers
 └── views/             # Top-level Page compositions
```

**Refactor Roadmap (3 Phases):**
1. **Phase 1: Foundation & State** - Introduce Zustand for global state. Move `userId`, `region`, and `savedMovies` out of [App.jsx](file:///Users/a40490/Documents/Cine%20Search/src/App.jsx) and into a store.
2. **Phase 2: Data Fetching Overhaul** - Introduce React Query. Replace [useMovieSearch](file:///Users/a40490/Documents/Cine%20Search/src/hooks/useMovieSearch.js#4-30) with `useQuery`. Rewrite the complex unified pagination logic to avoid potential infinite request waterfalls.
3. **Phase 3: Auth & Security** - Implement true Supabase Authentication and RLS policies. Remove `localStorage` reliance. Implement rate limiting on the `/api` route.

---

## 8️⃣ Risk Matrix & Summary

| Risk Level | Issue Identification | Why it matters |
|------------|----------------------|----------------|
| **Urgent** | `localStorage` Auth | Prevents RLS locking. Next pillar (Auth/Social) relies on this. |
| **High**   | Unified Fill Pagination | Potential to trigger 10+ consecutive TMDB API calls for a single UI page load. |
| **High**   | Memory Leak in API Proxy | The `Map()` cache has no eviction policy and will crash container over time. |
| **Medium** | "God Component" `App.jsx` | Prop drilling causes heavy re-renders and slows development velocity. |
| **Low**    | Missing Image Optimizations | Large TMDB images loading unoptimized on mobile. |

### Summary Diagnosis
The app is well-architected for a rapid prototype. The UI components are clean, and the visual/layout logic is solid. However, the data management architecture has outgrown its current design. The coupling of API pagination mechanisms with the UI and the reliance on heavy prop-drilling needs to be rectified before adding new pillars like Social and AI.

**Readiness Score for Scaling:** **5 / 10** 
*(Needs structural refactoring of state and data-fetching before adding new features).*
