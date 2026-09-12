# Milestone 1 — Browse as a guest

**Scope:** the whole product, read-only. No accounts, no tracking, no library.
**Why first:** it needs no user tables, so it isn't blocked on the database rebuild — and it proves the riskiest change (routing) early.
**Draft by Claude, 2026-09-12. Edit or reject by number.**

Numbered so you can strike any single line. `M1.x` throughout.

---

## M1.1 — Routing and shell

- **1.1.1** Every screen has its own URL: `/`, `/search`, `/title/movie/:id`, `/title/tv/:id`, `/person/:id`, `/404`.
- **1.1.2** The browser back button always goes back one screen. Never out of the app, never two screens at once.
- **1.1.3** Pasting a title or person URL into a fresh tab loads that screen directly.
- **1.1.4** Refreshing any screen reloads that same screen, not the home page.
- **1.1.5** Bottom navigation appears **only** on top-level destinations (home, search, and later library and you). Never on a title or person page.
- **1.1.6** A title or person page shows a back control that returns to where you came from, not always to home.
- **1.1.7** Forward navigation works after going back.
- **1.1.8** Scroll position is restored when returning to a list you'd scrolled down.

## M1.2 — Cover page

- **1.2.1** A first-time visitor lands on the cover page before anything else.
- **1.2.2** It offers exactly three actions: **Sign in**, **Create account**, **Just looking around**.
- **1.2.3** Choosing "Just looking around" is remembered. Returning visitors go straight to home and are not asked again.
- **1.2.4** Once browsing as a guest, a **Sign in** control stays visible in the shell at all times.
- **1.2.5** Signing in or creating an account is possible from that control at any point without losing the current screen.
- **1.2.6** The cover page does not block or delay a returning signed-in user.

*Depends on: cover page design, currently with the design chat.*

## M1.3 — Search

- **1.3.1** Search behaves exactly as it does today. No changes to ranking, filters or pagination.
- **1.3.2** Results are a grid with title, year and poster.
- **1.3.3** Tapping a result opens that title's page.
- **1.3.4** Filters expand in place and push results down. They do not open a sheet.
- **1.3.5** The current query is in the URL, so a search can be shared or bookmarked.
- **1.3.6** No results shows a spelling suggestion, the count of active filters, and a way to clear them.
- **1.3.7** Person results appear after titles, only when the query plausibly names a person.
- **1.3.8** Collection progress is **not** shown on person rows in this milestone — it needs the library, which doesn't exist yet.

## M1.4 — Title page, film

- **1.4.1** One request fetches everything: details, credits, providers, similar, keywords.
- **1.4.2** Shows backdrop, poster, title, year, runtime as `2h 47m`, genres and certification.
- **1.4.3** A missing certification is omitted and the line reflows. Nothing empty is drawn. *(Verified real: Dune: Part Two returns an empty certification for India.)*
- **1.4.4** Synopsis is shown, collapsed past a few lines, expandable.
- **1.4.5** Where to watch lists streaming, rent and buy separately, and **prints the country name**.
- **1.4.6** No providers in that country shows "Not streaming in *country*" plus a JustWatch link. Never an empty box.
- **1.4.7** TMDB's score is shown, with its vote count.
- **1.4.8** Top cast appears as a horizontal rail; tapping a person opens their page.
- **1.4.9** The director is named and tappable.
- **1.4.10** Keywords are shown. *(Tappable is Milestone 3.)*
- **1.4.11** A missing poster or backdrop renders a placeholder carrying the title in type. Never a broken image.
- **1.4.12** Tracking controls are visible but inert for guests — see M1.7.
- **1.4.13** If one section's data fails, only that section shows an error. The rest of the page still renders.

## M1.5 — Title page, series

- **1.5.1** Everything in M1.4 applies, plus the below.
- **1.5.2** Creator is named and tappable.
- **1.5.3** Season count and total episode count are shown.
- **1.5.4** An episode guide lists episodes per season with name, air date, runtime and score.
- **1.5.5** Seasons are switchable; the current season's episodes load on demand.
- **1.5.6** Specials (season 0) are on their own tab and excluded from totals. *(Verified: Breaking Bad's 62 episodes already exclude its 9 specials.)*
- **1.5.7** Unaired episodes render dimmed and cannot be interacted with.
- **1.5.8** Per-episode runtimes are shown as returned, never an average. *(Verified: 59m then 49m inside one season.)*
- **1.5.9** Long episode titles wrap to two lines without breaking the row.

## M1.6 — Person page

- **1.6.1** Shows photo, name, known-for department, birthday and place of birth.
- **1.6.2** Roles are switchable tabs with counts — Director, Writer, Cast — showing only roles the person actually has.
- **1.6.3** Filmography comes before biography.
- **1.6.4** Each filmography entry shows poster, title and year, and opens that title's page.
- **1.6.5** Filmography is ordered newest first.
- **1.6.6** Unreleased work with no date is excluded. *(Verified: 2 of Villeneuve's 26 raw director credits have no release date.)*
- **1.6.7** No photo renders initials on a neutral circle.
- **1.6.8** Collection progress is **not** shown in this milestone — it needs the library.

## M1.7 — Guests

- **1.7.1** A guest can reach every screen in this milestone.
- **1.7.2** Tracking controls are visible, not hidden. A guest should see what the product does.
- **1.7.3** Tapping any tracking control opens a sign-in prompt — it never silently fails and never does nothing.
- **1.7.4** **The intended action is remembered and applied after signing in.** Tap "Watched" on Dune, create an account, land back on Dune already marked watched.
- **1.7.5** Nothing a guest does is written to browser storage as library data. No parallel local store.
- **1.7.6** The guest's country is detected from their IP exactly as it is today.

## M1.8 — States

- **1.8.1** Loading shows skeletons shaped like the content that's coming, so nothing shifts on arrival.
- **1.8.2** Every empty state names one action. Never a bare illustration.
- **1.8.3** A title or person ID that TMDB doesn't recognise shows not-found, not a blank screen.
- **1.8.4** An unknown URL shows not-found with a route back to home.
- **1.8.5** When TMDB is unreachable, the page says so and offers retry.

## M1.9 — Non-functional

- **1.9.1** Designed at 375px first; usable up to desktop width.
- **1.9.2** The page body never scrolls sideways.
- **1.9.3** Every colour comes from a Projector token. No raw hex in components.
- **1.9.4** Light and dark both render correctly.
- **1.9.5** Keyboard focus is always visible.
- **1.9.6** `prefers-reduced-motion` is honoured.
- **1.9.7** `npm run lint` and `npm run build` both pass.
- **1.9.8** TMDB and JustWatch attribution appears on any screen showing their data.

---

## Explicitly out of Milestone 1

Accounts, sign-in, the editor sheet, statuses, ratings, episode ticking, library, activity, home rails, settings, taste, catalogue caching, and collection progress.
