# Cine Search — Use-case register

**For:** the design pass. One row per use case: who, what starts it, what should
happen. Compact on purpose — the reasoning lives in the module documents, this
is the index you test against.

**Status key**
`✅` built and working · `◐` built but incomplete · `○` designed, not built ·
`◆` open design decision · `—` deliberately out of scope

Cross-references are the real ids from the module docs (`SH*` shell, `L*`
library, `TS*` title, `FD/FQ/FB*` find, `P/E/C*` profile, `#n` entry cases), so
anything here can be traced back and argued with.

---

## A · Arrival

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| A1 | First visit ever | Opens `/` with no local stamp | The cover, once. Never again. `SH17` `FD9` | ✅ |
| A2 | Arrives on a shared title link | Opens `/title/movie/693134` cold | Straight to the title. The catalogue is never gated and the cover never intercepts | ✅ |
| A3 | Arrives on a shared browse link | Opens `/search?genre=53&rating=7` | Chips restored, same results, same order. `FB11` | ✅ |
| A4 | Arrives on a shared person link | Opens `/person/525` | Person page, no gate | ✅ |
| A5 | Returning guest | Second visit, never signed up | Discover directly. No cover, no modal, no nag | ✅ |
| A6 | Unknown URL | `/libary` typo, or a dead link | Not-found **with the tab bar** and one button out. `SH13` | ✅ |
| A7 | Lands mid-list, hits back | Taps a tile from halfway down, returns | Scroll position restored, grid pages **not** restored | ✅ `S3` both restored |
| A8 | Opens in a second tab | Two tabs, same browser | Both work; library state is per-tab until a write | ✅ |
| A9 | Installs / opens as app on phone | Capacitor shell (iOS/Android dirs exist, unbuilt) | — | ◆ |

## B · Creating an account

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| B1 | Signs up cleanly | Username + email + password | Account, profile row, landed back where they started | ✅ `#11` |
| B2 | Password too short | Types 6 characters | Rules shown and ticked **as they type**; nothing sent | ✅ `#12` |
| B3 | Email not invited | Uninvited address | Named reason, not "check your connection" | ✅ `#13` |
| B4 | Email already registered | Address in use | Says so, offers sign-in | ✅ `#14` |
| B5 | Username taken, caught early | Blur on the username field | Flagged **before** the account is created | ◐ needs `006_username.sql` `#16` |
| B6 | Username taken, caught late | Server rejects after account exists | Account is kept; one field left to fill. Never a dead end | ✅ `#15` |
| B7 | Account with no profile row | Interrupted between the two writes | Asked for a username, from wherever they are. `SH18` | ✅ `#17` |
| B8 | Case-colliding username | `Raman` vs `raman` | Treated as one name | ○ migration unapplied |
| B9 | Signed-in person opens `/welcome` | Types the URL or hits an old bookmark | Sent on, not shown the cover | ✅ `#18` `#19` |
| B10 | Nonsense auth URL | `/welcome/pizza` | Redirected to sign-in | ✅ `#20` |
| B11 | Guest acts, then signs up | Taps ♥ → signs up → returns | Lands on the title — **but the ♥ is still empty** | ◆ replay the action? |
| B12 | Sign-up step visual design | `signup` `forgot` `reset` `username` | Only `signin` and `cover` were ever drawn | ○ four screens undesigned |

## C · Session & identity

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| C1 | Returns next day, token expired | Opens Library after an hour away | Loading, then their library. **Never** a "create an account" button | ✅ `#1` |
| C2 | Session question unanswered | Any first paint | Account control shows neither a name nor Sign in. Three states, never two. `SH6` | ✅ |
| C3 | Refresh token revoked | Token reused or revoked server-side | Dismissible banner: "Your session ended." Not a silent drop to guest. `SH5` `#3` | ✅ |
| C4 | Profile read fails on a blip | Network hiccup | Treated as a blip and recovers — not as "no profile" | ✅ `#5` |
| C5 | Signs out | Taps sign out | Guest state, nothing alarming said | ✅ `#24` |
| C6 | Signs out with two tabs open | Other tab is on Library | Other tab signs out **quietly** — not "your session ended" | ✅ `#25` |
| C7 | Forgot password | Taps the link | Email sent; same answer whether the address exists or not | ✅ `#21` |
| C8 | Reset link expired | Opens an old email link | Says so, offers a new one | ✅ `#22` |
| C9 | Opens `/welcome/reset` with no link | Direct URL | Handled, does not pretend to be a reset form | ✅ |
| C10 | Reset email can't come back | Redirect URL not allowlisted | — | ○ **your Supabase dashboard** |
| C11 | Reads back what they typed | Taps show/hide | Password visible | ✅ `#23` |
| C12 | Wrong password | Bad credentials | Identical message to an unknown email, on purpose | ✅ `#8` |
| C13 | Rate limited | Too many attempts | "Too many attempts. Wait a minute" | ✅ `#10` |
| C14 | Offline at sign-in | No connection | "Can't reach the server" — not "Failed to fetch" | ✅ `#9` |
| C15 | Guest on a phone wants to sign in | No top bar on a 600px screen | The You tab offers both create and sign in. `SH16` | ✅ |
| C16 | Weak/breached password accepted | Signs up with `password123` | — | ○ **your Supabase dashboard** |

## D · Discover

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| D1 | Guest opens Discover | Tab 1 | Presets at position 2, two rails, one sign-up card, then the rest. `FD1` | ✅ |
| D2 | Signed in, empty library | First session after sign-up | Same without the sign-up card. Presets stay high. `FD2` | ✅ |
| D3 | Active library | Has things in progress | Continue watching first, Want to watch second, presets drop below. `FD3` | ✅ |
| D4 | Nothing watched yet | No completed titles | "Because you watched" is **absent**, not empty. `FD6` | ✅ |
| D5 | One rail fails | TMDB 500 on one feed | That rail shows its own error and retry; the others render. `FD4` | ✅ |
| D6 | Every rail fails | Offline | **One** message for the page, one retry that re-runs all. `FD5` | ✅ |
| D7 | Region unknown | No header, no time-zone match | "In cinemas" falls back to global and **drops the country from its title**. `FD7` | ✅ |
| D8 | A rail returns 3 items | Thin week | It still draws. A short rail is a fact; no padding with unrelated items. `FD8` | ✅ |
| D9 | Taps a rail header | "Trending this week" | Opens Browse with that rail's own query as chips. `FB13` | ✅ |
| D10 | Taps a preset | "Edge of the seat" | Lands on Search with its facets as chips, takeable apart one at a time. `FB12` | ✅ |
| D11 | "With the parents" missing | No region chosen | Preset is absent rather than wrong | ◆ prompt for region on tap? |
| D12 | Quick-add from a rail | Taps + on a tile | Badge changes **and** a named undoable toast. `SH15` | ✅ |
| D13 | Guest quick-adds | Taps + with no account | Sign-in sheet naming the title it will save. `FQ27` | ✅ |

## E · Search by name

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| E1 | Opens Search, box empty | Tab 2 | Recents, then presets. Never a question they answered by arriving. `FQ0` | ✅ |
| E2 | Types one character | `i` | No request at all. `FQ29` | ✅ |
| E3 | Types two, pauses | `in` + 250ms | One request after the quiet. `FQ29` | ✅ |
| E4 | Clean hit | `inception` | Count, then the grid. Every tile carries its library state and a +. `FQ1` | ✅ |
| E5 | Titles and people | `nolan` | People **after** the grid, at most three, gated on a photo. `FQ2` | ✅ |
| E6 | Query *is* a person | `christopher nolan` | Person row first, grid below is **their work** | ✅ `FQ3` `#112` |
| E7 | Two people, same name | Ambiguous name | Neither promoted; both rows with evidence lines | ✅ `FQ4` `#112` — `roger deakins` no longer collides at TMDB; `mike mitchell`, `chris williams`, `james murray` and `john williams` do |
| E8 | Query is a franchise | `lord of the rings` | One collection band above the grid, release order, "3 of 8 seen" | ◐ `FQ5` `#112` — band, fraction and release order ship as a rail; the frame's numbered **strip** needs one CSS rule and the band appears for any franchise member, not only a franchise-shaped query |
| E9 | Person with no photo | TMDB finds anyone for any string | Excluded. `FQ6` | ✅ |
| E10 | Rescued by truncation | `interstellar movie` | "Showing results for interstellar", original one tap away. `FQ7` | ✅ |
| E11 | Rescued by word retry | `koi acchi thriller movie` | Phrased as a **question**, not a claim. `FQ8` | ✅ |
| E12 | Typo with one candidate | `inceptoin` | Query quoted, one "did you mean". Never five guesses. `FQ9` | ✅ |
| E13 | Typo, but results came back | `stanger things` returns 1 irrelevant row | Ladder **does not fire** — it only triggers on empty | ◆ trigger on "nothing acceptable" |
| E14 | Typo needing a dictionary | `sholey`, `dangl` | — | ◆ rung 5, ruled "not yet" |
| E15 | Parses as facets instead | `tamil thriller` finds no title | Offers the browse, with three real results shown beneath. `FQ10` | ✅ |
| E16 | Nothing, nothing to suggest | `film about a sad robot` | Honest exit: what was searched, that we search **names not plots**, recents, presets. `FQ11` | ✅ |
| E17 | Request failed | TMDB unreachable | "Could not reach TMDB" + retry. Never "nothing found". `FQ12` | ✅ |
| E18 | Titles arrived, people failed | Partial failure | Grid renders; people retries once then stays away. `FQ13` | ✅ |
| E19 | In flight | Request pending | Six poster skeletons at the grid's own geometry. `FQ14` | ✅ |
| E20 | Stale response lands last | `inc` resolves after `inception` | Discarded. Keyed to the query that asked. `FQ15` | ✅ |
| E21 | Box cleared mid-request | Taps × | Aborted; resting state returns instantly. `FQ16` | ✅ |
| E22 | Title pasted with its year | `Inception (2010)` | Year becomes a **chip**, name goes to the box. `FQ17` | ✅ removable chip, name in the box |
| E23 | TMDB or IMDb URL pasted | Pastes a link | Resolved straight to that title — a URL is a destination, not a search | ✅ `FQ18` titles only; a person URL still falls through |
| E24 | Switches media type | Taps the Films tab | Client-side split of the response in hand. Instant, no request. `FQ19` | ✅ |
| E25 | People tab with no people | Filter on, zero people | "No people match — 34 titles do", with the way back. `FQ20` | ✅ |
| E26 | Four results, same name | Remakes | Year and poster carry the difference; year never omitted (—). `FQ21` | ✅ |
| E27 | Result with no poster | Missing artwork | Placeholder carrying the title in type. Never a broken image. `FQ22` | ✅ |
| E28 | Very long title | 90-character name | Two lines then ellipsis. Tile never grows, grid never goes ragged. `FQ23` | ✅ |
| E29 | Adult results | Any query | Excluded **at the request**, not filtered after. `FQ24` | ✅ |
| E30 | More than twenty results | Scrolls to the end | Load more — a button, not infinite scroll. `FQ25` | ✅ |
| E31 | Back from a title | Opened a result, returns | Query, loaded pages **and** scroll all restored. `FQ26` | ✅ |
| E32 | Already in the library | Result they saved | Badge reports the state; + does not re-offer. `FQ28` | ✅ |
| E33 | Emoji, RTL, 300 characters | Pastes anything | Sent as typed, allowed to fail into E16. The box never validates. `FQ30` | ✅ |

## F · Browse by filter

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| F1 | Sets facets, gets results | Picks Thriller + 7+ | Chips, a count line printing **every** constraint and the ordering, then the grid. `FB1` | ✅ |
| F2 | Chips exclude each other | Tamil + Animation + Netflix = 0 | Names the **chip responsible**, found by dropping each in turn. `FB2` | ✅ |
| F3 | Combination that cannot exist | Series + Horror | Says which facet is impossible **here**, rather than returning zero. `FB3` | ✅ |
| F4 | Twenty thousand results | Broad filter | Count reads `20,000+`, never 20,001 — that figure is a ceiling. `FB4` | ✅ |
| F5 | Hits the page ceiling | Loads to page 500 | Load more retires: "that is as deep as TMDB goes — narrow it". Not an error. `FB5` | ✅ |
| F6 | Switches medium with a medium-only genre | Thriller set, taps Series | Genre dropped **and named** in the chip row. Never silently mapped. `FB6` | ✅ |
| F7 | Provider list unavailable | TMDB provider call fails | Facet is **absent** for that session, not empty. `FB7` | ✅ |
| F8 | Region not set, uses where-to-watch | First tap on a provider facet | Asked once, then remembered. Never guessed from an IP. `FB8` | ✅ |
| F9 | Changes the sort | Picks "most voted" | Back to page one, scrolled to top. `FB9` | ✅ |
| F10 | More chips than fit | Six facets on a phone | Wrap to a second line, then the row scrolls. Never truncated. `FB10` | ✅ |
| F11 | Shares or bookmarks a browse | Copies the URL | Everything is in the URL — including the region. `FB11` | ✅ |
| F12 | Opens the panel | Taps Filters | Stays open while the grid moves underneath. No Apply, no Cancel. `FB14` | ✅ |
| F13 | Opens "More filters" | Wants language or runtime | Four more rows unfold in place; remembered for the session. `FB15` | ✅ |
| F14 | Hides what they've seen | Toggles it on | Filtered against the library in memory — exact. Count says both: "18 of 20 shown · 2 already watched". `FB16` | ✅ |
| F15 | Guest tries to hide seen | No account | Switch is **absent**, not disabled. `FB17` | ✅ |
| F16 | A facet that cannot act | No region, or genre the medium lacks | Absent. `FB18` | ✅ |
| F17 | Rating as a sort | Wants "highest rated" | Not offered — a rating is a **band**, ordered by evidence (vote count) | ✅ by design |

## G · Title page — film

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| G1 | Opens a film | Taps a tile | Spine: art, title, year, runtime, certificate, score, actions | ✅ `TS1` |
| G2 | Sets a status | Taps the status control | Planning / Watched / Dropped — films get three, not six | ✅ |
| G3 | Rates before watching | Taps the star on a Planning title | Locked. Rating opens only on Watched or Rewatching | ✅ |
| G4 | Logs a rewatch | Taps rewatch | Counter increments; status may become Rewatching | ✅ |
| G5 | Favourites it | Taps ♥ | Immediate, undoable | ✅ |
| G6 | Writes a note | Opens the editor | Stored, shown back in "Your note" | ✅ `TS1c` |
| G7 | Records who recommended it | Fills "Who recommended it?" | Stored, shown as "From Priya" | ✅ |
| G8 | Checks where to watch | Scrolls to the band | Streaming first, named country, rent/buy behind a sheet | ✅ |
| G9 | No providers in region | Nothing streams there | "Not available in India" + a link to options. Never a blank band. `TS12` | ✅ |
| G10 | No certificate | TMDB has none for that country | "Not rated in India" — stated, not blank. `TS11` | ✅ |
| G11 | Reads background | Wikipedia band | Labelled as Wikipedia's words, never ours. Link out | ✅ |
| G12 | No Wikipedia article | Obscure title | Band absent. `TS2` | ✅ |
| G13 | No TMDB overview | Sparse record | Says so rather than leaving a gap. `TS3` | ✅ |
| G14 | Watches the trailer | Taps play | Opens the video | ✅ `TS1b` |
| G15 | Part of a collection | A franchise entry | Collection band, release order, progress against it | ✅ |
| G16 | Browses the cast | Scrolls | Cast rail → person pages | ✅ |
| G17 | Guest tries to save | Taps + or ♥ | Sign-in sheet naming the title. `TS4` | ✅ |
| G18 | Session restoring | Opens cold with an expired token | Actions held, not shown as guest. `TS5` | ✅ |
| G19 | Loading | Request in flight | Skeleton at the page's own geometry. `TS6` | ✅ |
| G20 | Title not found | Bad id | Not-found, not a crash. `TS7` | ✅ |
| G21 | No backdrop | Missing art | Layout holds. `TS8` | ✅ |
| G22 | No artwork at all | Nothing | Typographic fallback. `TS9` | ✅ |
| G23 | Very long title | Long name | Clamped; the spine does not reflow. `TS10` | ✅ |
| G24 | A write fails | Save rolls back | Named, never a silent revert. `TS13` | ✅ |
| G25 | Desktop / wide | 1120+ | Two-column spine. `TS14` | ✅ |
| G26 | Wants trivia / production facts | Hobbyist persona | — | — not in TMDB; source undecided |

## H · Title page — series & episodes

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| H1 | Opens a running series | Taps a tile | Cohort line: next episode, date, progress | ✅ |
| H2 | Opens a finished series | Breaking Bad | Percentage complete — **only** when finished | ✅ |
| H3 | Opens a miniseries | Chernobyl | Keeps "Miniseries", not "S1" | ✅ |
| H4 | Opens an unreleased series | Announced only | No progress furniture, no 0 of 0 | ✅ |
| H5 | Picks a season | Taps a tab | Specials ordered **last**; arriving selects the right season, never Specials | ✅ |
| H6 | Ticks an episode | Taps the box | Immediate, undoable | ✅ |
| H7 | Uses the stepper | Taps + | Advances one, stores the set | ✅ |
| H8 | Episode has no name | TMDB blank | "Episode 7" rather than empty. `TV7` | ✅ |
| H9 | No episode data at all | TMDB has the series, no seasons | No track, no +, and a line saying progress is unavailable. **Not a 0 of 0 bar.** `L17` | ✅ |
| H10 | Finishes every episode, status still Watching | Last tick | Offer "Mark watched?" **once**, inline. Never change their record for them | ✅ `L21` buttons only, no question line |
| H11 | Film carrying a series status | Letterboxd import | Renders with that status, not silently rewritten. `L18` | ✅ |
| H12 | Six statuses | TV only | Planning / Watching / On hold / Watched / Rewatching / Dropped | ✅ |

## I · Library

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| I1 | Opens a healthy library | Tab 3 | Shelf chips, rows with progress, a line saying why a shelf is thin. `L1` | ✅ |
| I2 | Empty library | Nothing saved | No chips, no find, no sort — controls over an empty list look broken, not new. `L7` | ✅ |
| I3 | Guest | No account | The sign-in sheet, verb matched. The catalogue is never gated; **a library is**. `L13` | ✅ |
| I4 | Session restoring | Expired token | Loading — **not** "sign in to keep a library". We don't know yet. `L9` | ✅ |
| I5 | Read fails | Supabase down | "Nothing is lost." A read failure is not a data failure. `L10` | ✅ |
| I6 | Finds a title | Types in find | Ignores the status filter — they want a title, not a shelf. "3 of 203". `L2` | ✅ |
| I7 | Find matches nothing | No local match | Hands over to Search **carrying the typed text**. `L6` | ✅ |
| I8 | Find while a filter is on | Filter + query | Find wins; the filter is visibly set aside with a way back. `L20` | ✅ |
| I9 | Find matches a recommender | Types "Priya" | Their titles, with a count and how many are watched | ✅ `L27` |
| I10 | Switches density | Taps compact | Eleven rows where comfortable fits three. Remembered. `L3` | ✅ |
| I11 | Sorts a shelf | Opens the sort sheet | Options change with the shelf; remembered **per shelf**. `L4` `L15` | ✅ |
| I12 | Sorts by recommender | Wants the From section | Appears in the sheet only once a name exists | ✅ `L28` `L29` |
| I13 | Shelf with no films | On hold | "A film is never on hold." A reason, not an apology. `L5` | ✅ |
| I14 | Only one shelf has anything | Brand new | Five chips absent, one selected. Not a row of zeroes. `L19` | ✅ |
| I15 | A row shows its recommender | Saved with a name | Third line in the accent: "From Priya". Absence is unmarked. `L26` | ◐ series rows; films are tiles at this density, and a tile has no third line |
| I16 | Edits an entry | Taps a row | Sheet: status, progress, rating, notes. Remove is footer-isolated and confirms. `L12` | ✅ |
| I17 | Removes while looking at it | Confirms remove | Row goes immediately; undo is the **toast**, not the row. `L22` | ✅ |
| I18 | A write rolls back | Save fails | "Couldn't save E7. Put back to E6." Names the episode. `L11` | ✅ |
| I19 | Past a thousand titles | Letterboxd import, 2,400 rows | Pages until the server says it's done. `L14` | ✅ |
| I20 | Loading | First paint | Chips and rows skeleton; the heading does not. `L8` | ✅ |
| I21 | Very long title | Long name | One line with ellipsis in a row; two clamped in a grid. The + never moves. `L16` | ✅ |
| I22 | 320px phone | Smallest band | Compact fits 16 rows, comfortable 7. Neither scrolls sideways. `L23` | ✅ |
| I23 | Desktop | 1120 / 1440 | Series left at 420px, films right and filling; caps at 1600. `L24` `L25` | ✅ |
| I24 | "What should I watch tonight?" | Opens Library with no plan | — | ◆ §Three ideas: *Tonight* |
| I25 | Wants to see their own gaps | Cinephile, diversity | — | ◆ §Three ideas: *Negative space* |

## J · Profile (You)

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| J1 | Own profile, filled | Tab 4 | Banner, avatar, bio, four stats, four shelves. Edit affordances quiet. `P1` | ✅ |
| J2 | Brand new profile | Right after sign-up | Hatched banner, initial avatar, honest zeroes, one combined empty shelf. `P2` | ✅ |
| J3 | Loading | First paint | Stat tiles keep their **labels** and skeleton only the numbers, so the strip doesn't resize. `P3` | ✅ |
| J4 | Stats fail, profile fine | One query dies | Strip shows a Try again; the rest is unaffected. `P4` | ✅ |
| J5 | Offline | No network | Everything from `catalog_*` renders; faces fall back to gradients. `P5` | ✅ |
| J6 | Long bio | Over four lines | Clamped with an inline "more". Never a scroll region. `P6` | ✅ |
| J7 | Long display name | 40 characters | Two lines then ellipsis; the handle truncates from the end, never wraps. `P7` | ✅ |
| J8 | Non-Latin name | 神谷 | Avatar initial uses the first **grapheme**: 神. `P8` | ✅ |
| J9 | Edits identity | Taps edit | Sheet: name, handle, bio with a live 280 counter. Handle checked on blur. `E1` `E2` | ✅ |
| J10 | Chooses a banner | Taps Add/Edit | Sheet with the catalogue sources; current ticked. `E3` | ✅ |
| J11 | Uploads a banner | Wants their own image | Crop at 4:1, progress, cancel restores | — settled: catalogue only first `D2` |
| J12 | Picks favourites | First-run invitation on the profile | Four shelves, eight each | ✅ `D6` |
| J13 | Ninth favourite | Shelf full | "Which one does *Arrival* replace?" with the eight shown. Never a silent refusal. `E7` | ✅ |
| J14 | Reorders a shelf | Drags a card | Drag handles, other shelves dim, undo toast. `E6` | ◐ reorder is ← → buttons, not drag |
| J15 | Removes a favourite | Taps × | Immediate with undo. No dialog for a reversible act. `E8` | ✅ |
| J16 | Adds a character | Opens the picker | Two doors plus recently watched. `C1` `C2` | ✅ |
| J17 | Character already favourited | Sees it in the picker | Row ticked and **disabled**, not hidden. `C3` | ✅ |
| J18 | Animated title | Picks a voice role | "Voice · Hiroshi Kamiya" on the actor line. `C4` | ✅ |
| J19 | Credit vanished from TMDB | Upstream deletion | Stored strings still render; face drops to the poster. `C5` | ✅ |
| J20 | Cast list empty | TMDB blank | "TMDB has no cast for this yet." `C6` | ✅ |
| J21 | Wants to be seen | Cinephile / Critic persona | A **public** profile anyone can read | — Layer 3, parked |
| J22 | Wants follow counts | Social | — | — parked `D1` |

## K · Person page

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| K1 | Opens a director | Taps a crew name | Roles ordered by evidence; progress against their body of work | ✅ |
| K2 | Opens an actor | Taps a cast name | Known-for ordered by rank, not popularity | ✅ |
| K3 | Both actor and director | Clint Eastwood | 25% band: neither wins, both shown | ✅ |
| K4 | Mostly talk-show appearances | A presenter | Talk/News/Reality excluded from the **ranking signal** only | ✅ |
| K5 | Progress against a creator | "8 of 10 Tarantino" | Offered for director / creator / writer only | ✅ |
| K6 | Favourites a person | Taps ♥ | Stored, appears on the profile shelf | ✅ |
| K7 | No photo | Missing image | Typographic fallback | ✅ |
| K8 | Thin credits | One film | Active years and evidence line still true | ✅ |

## L · Settings & preferences

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| L1 | Sets the theme | Taps Light/Dark/System | Three segments, because the system has three states. `SH9` | ✅ |
| L2 | Returns with a stored theme | Reload | Applied **before** React mounts — the other theme never flashes. `SH10` | ✅ |
| L3 | Sets their country | Picks from nine | Every mounted screen updates at once. `SH8` | ✅ |
| L4 | Region guessed | First region-dependent block | Named country, one-tap correction, **no request to any third party**. `SH7` | ✅ |
| L5 | Travels | Flies to London | The guess changes; a **choice** never does | ✅ |
| L6 | Guest opens Settings | Taps through | Theme and region work — they're about this browser, not this account | ✅ |
| L7 | Reduced motion | OS preference | Every animation collapses to 0.01ms, once, globally. `SH20` | ✅ |
| L8 | Settings is unreachable on a phone | Guest, 600px, no top bar | Reachable via You. `SH16` | ✅ |
| L9 | Exports their data | Wants their library out | — | ◆ not designed |
| L10 | Imports from Letterboxd | Has a CSV export | — | ◆ not designed; the data model allows for it |
| L11 | Deletes their account | Wants out | — | ◆ not designed |

## M · Cross-cutting

| # | Use case | Trigger | Expected behaviour | ✓ |
|---|---|---|---|---|
| M1 | A route's chunk is loading | Any navigation | Shell stays, three skeleton blocks. **Never** a blank page. `SH1` | ✅ |
| M2 | A route throws | Render error in a module | Route boundary: message, two actions, a reference. Tabs intact. `SH2` | ✅ |
| M3 | The shell itself throws | Error above the router | Last-resort screen with a reload. `SH3` | ✅ |
| M4 | Broken screen, then navigates | Error showing, taps another tab | Boundary **resets**. One broken screen is not a broken tab. `SH4` | ✅ |
| M5 | Offline | Connection drops | Each section's own error and retry. No global offline bar. `SH14` | ✅ |
| M6 | Any screen reports an action | Save, remove, reorder | **One** toast, owned by the shell, above the tab bar, clear of the safe area. `SH15` | ✅ |
| M7 | Navigates forward | Push | Scroll to top, focus to the heading, route name announced. `SH11` | ✅ |
| M8 | Goes back | Pop | The scroll position they left | ✅ `SH12` `S3` pages and position |
| M9 | Screen reader, route change | Tab press | The page is announced. The design calls this the single largest a11y gap it closed | ✅ |
| M10 | Tabs on a title page | Opens a title | **Absent** — a title page is somewhere you came back from. `SH19` | ✅ |
| M11 | Desktop | 1120 / 1440 | One bar, nothing repeated. Six columns at 1440 | ✅ |
| M12 | 320px | Smallest phone | Nothing scrolls sideways | ✅ |
| M13 | A write races a read | Two tabs, same title | Last write wins; the row reflects the server | ◐ untested |
| M14 | TMDB rate limits us | Burst of requests | — | ◆ no backoff designed |
| M15 | Someone shares a link to a dead title | TMDB deletion | Not-found, not a crash | ✅ |

## N · Out of scope, named so it stays that way

| Area | Decision |
|---|---|
| Public profiles | Layer 3 — parked indefinitely, 2026-09-13 |
| Follows, feeds, likes, comments, notifications | Layer 4 — parked |
| Reviews and critique with distribution | The Critic persona is unserved. Known, accepted |
| Trivia and production facts | Not in TMDB. The Hobbyist persona is partly unserved; source undecided |
| Rung 5 (typo dictionary) | Ruled "not yet" |
| Certification as a search facet | Rejected — a certificate is national. Lives in the "With the parents" preset instead |

---

## The twelve worth designing for

Ordered by how often a real person would hit them, not by effort.

1. **E1 / E16 — recents don't exist.** Two designed states lean on them, and the
   empty-search screen is the second-most-seen screen in the product.
2. **E13 — the rescue ladder only fires on *empty*.** `stanger things` returns
   one irrelevant row, so the ladder stays silent even though rung 4 has the
   answer at edit distance 1. The trigger should be "nothing acceptable".
3. ~~**E6 / E7 / E8 — person-first and franchise-first results.**~~ Built in
   `#112`. What is left of it: the FQ5 band draws as a rail rather than the
   frame's numbered strip, which needs one rule in `src/modules/search/search.css`;
   and whether the band belongs on *every* franchise member (`dune` gets one
   today) or only on a franchise-shaped query is a product call, not a bug.
   Separately, the shipped people floor of `popularity >= 1` now excludes
   Rajkumar Hirani, Nawazuddin Siddiqui, Satyajit Ray, Sanjay Leela Bhansali
   and Ram Gopal Varma from the **people section** — promotion no longer reads
   that number, but the section still does. `FQ2` / `FQ6`.
4. **H10 — ticking the last episode doesn't offer to close the series.** The
   record stays "Watching" forever unless they go and change it.
5. **B11 — the action that sent someone to sign up is never replayed.** They
   tap ♥, sign up, come back, and the heart is empty. Your call: complete it
   silently, or show it completing.
6. **I9 / I12 / I15 — "recommended by" is half-built.** It's stored, it's
   editable, it shows on the title page — but the library can't find by it or
   sort by it, which is where the Tracker persona would use it.
7. **E23 — a pasted TMDB/IMDb URL searches instead of navigating.**
8. **D11 — "With the parents" is invisible until a region is set.** My
   recommendation stands: prompt on tap, the same moment-of-first-use rule `FB8`
   already uses.
9. **A7 / E31 / M8 — back restores position but not loaded pages.** On a browse
   someone scrolled four pages deep, back is still a short list.
10. **L9 / L10 / L11 — no export, no import, no delete.** The data model permits
    all three. A tracker that can't give data back is a tracker people don't
    trust with a decade of it.
11. **B12 — four auth screens were never drawn.** `signup`, `forgot`, `reset`,
    `username` work and are consistent, but they're wearing the sign-in form's
    clothes.
12. **B5 / B8 / C10 / C16 — four things outside the code.** One SQL migration
    (`006_username.sql`) and two Supabase dashboard settings. These need you,
    not a build.
