# Cine Search — how work is done here

Live at **bingecon.com**. The repo, the directory and the `cine_*` storage keys
stay "Cine Search" on purpose.

Raman is a **Product Manager, not an engineer**. Explain tradeoffs in product
terms and always give a recommendation. His lane is design, UI/UX and PM, plus
every stylesheet (`.css`, shared and module). `.jsx` and `.js` are not his —
any `src/` logic edit is development work, and development does not start until
grooming closes.

---

## The working rule: fix the class, not the instance

**A fix is not finished when the symptom goes. It is finished when that kind of
problem can no longer happen.**

Every bug belongs to a class. Fixing the instance and moving on guarantees the
class comes back wearing different clothes, which is how a product accumulates a
permanent background hum of small defects that never quite get solved.

So for every defect, two questions, in this order:

1. **What class is this an instance of?** Name it in one sentence, generally
   enough that a second instance would match the sentence.
2. **What is the strongest thing that makes the whole class impossible or
   caught?** Build that, not just the fix.

### The strength ladder

Not all prevention is equal. Take the strongest tier the problem allows, and
**say which tier you landed on** when you report the work:

| | Tier | What it means |
|---|---|---|
| **1** | **Unrepresentable** | Restructure so the bug cannot be written. A parse that cannot return a valid-looking wrong answer beats remembering to guard every call site |
| **2** | **Build-time** | A lint rule or a `verify` check. Fails before anything runs |
| **3** | **Harness** | A named assertion tied to a law or state id, so the test says *which rule* broke |
| **4** | **Visible** | A fingerprint, a report, a loud failure. Does not prevent — guarantees you find out |
| **5** | **Written down** | A note in a doc. Relies on somebody reading it |

**Tier 5 on its own is not a fix.** If a stronger tier was available and the
work stopped at a comment, the work is not done. Say so plainly rather than
reporting a fix.

### Prove the gate

A gate that can fail open is worse than no gate, because it buys false
confidence. **Reintroduce the bug and watch the new gate catch it.** This is not
optional diligence — it is how the gate earns the right to be trusted.

Earned the hard way: `verify` check 16 shipped with a wrong constant name and an
`if (ROLES.size)` guard, so it silently passed everything, and it ran *after*
failures were grouped so its complaints went unread. It was worse than no check
for as long as it existed, and only reintroducing the original bug found that.

### The rule of three

**Three instances of one class means stop fixing instances.** Three is not bad
luck; it is a structural invitation. At the third, the correct next action is the
class fix, even when it is more expensive than the third instance.

Watch for this in a single session too. Playwright route-order shadowing was hit
*three times in one sitting* before it was named — each time fixed as a one-off.

---

## Where gates live in this project

| Gate | Covers |
|---|---|
| `npm run verify` | 16 structural checks |
| `npm run find` | 87 search rules |
| `npm run cohorts` | 60 title-state cases |
| `npm run auth` | 38 session cases |
| `npm run test:api` | 6 endpoint cases |
| `npm run snap` | Screenshots + layout fingerprints, ~3–4 min. **Once before a PR**, not after each change |
| `docs/*-module.html` | State tables — `SH*` `L*` `TS*` `FD/FQ/FB*` `P/E/C*`. Every one is a law with an id |
| `docs/USE_CASES.md` | 219 use cases, journey A–M |

**Every test name cites a law or state id.** A test called "it works" is not a
gate; a test called `FB6 — medium switched with a medium-only genre` is.

**Known gap:** CI runs only `verify`, `build` and `test:api`. The 185
behavioural assertions in `find`, `cohorts` and `auth` run only when somebody
remembers. Fix this before adding to them.

---

## Classes already named

Do not rediscover these. If a new defect matches one, it is a repeat and the
class fix was insufficient — strengthen the gate rather than patching again.

**Absent must never become plausible.** A missing value that coerces into a
valid-looking wrong one is the most expensive bug shape in this codebase: four
instances. `Number(params.get('season'))` → `0`, and `0` is Specials, so every
arrival selected Specials. `{ q: undefined }` stringified to the literal
`"undefined"` and switched Browse off. `toQuery` fell back to
`watch_region: 'US'`, so a browse shared from Mumbai ran against US providers.
`VITE_SUPABASE_URL` undefined made `REF` fall back to `'project'` and write a
key nothing reads — twice blamed on timing. **Class fix: absent throws or stays
absent. It never defaults into something that looks like an answer.**

**A catch-all registered last shadows the specific ones.** Playwright route
order, three times.

**A pipe swallows the exit code.** `npm run snap 2>&1 | tail -2` inside an `&&`
chain hid a crash and let stale fingerprints be pushed.

**Live third-party data in a deterministic test is not a test.** `snap --check`
failed on an untouched `main` because TMDB had drifted. Class fix: every
third-party response, the region and the session are pinned.

**A shape that crosses a module boundary must be converted at the boundary.**
Two instances: `toCollectionView` written against a raw TMDB payload the
endpoint never returns, and Browse tiles linking to `/title/undefined/123`
because `discover` returns the harness shape while `Tile` wants the view shape.

**One module's design document cannot retract another's.** Deleting
`.head-actions` on the find document's instruction removed the only sign-in
route for a guest on a phone — the shell document had claimed it. Check the
other documents before acting on an instruction to remove something.

---

## Feedback and RCA

`docs/FEEDBACK_INTAKE.md` is the intake method. The short version:

Every reported problem is tagged to a use-case id from `USE_CASES.md`, or
recorded as new — and **new is the most interesting outcome**, because it means
the design never considered it.

Then classified by cause, because symptoms cluster uselessly and causes cluster
into fixes: **unbuilt · misbuilt · mis-designed · unanticipated · upstream ·
environmental.**

The split that does the work is **misbuilt** (code disagrees with its own design
doc) versus **mis-designed** (code matches the doc exactly and the doc is
wrong). They produce identical complaints and opposite responses. One means a
gate leaked; the other means the thinking was wrong, and only the second teaches
anything about users.

Then the rule of three, with one question asked of every cluster: **what gate
would have caught all of these?** If the answer is "none exists", that is an
architecture change, and it is the thing actually being hunted.

---

## Reporting work

State what was built, which tier of the ladder the prevention landed on, and
what is still exposed. Report failures with their output. A skipped step is
said out loud. Never report something as verified that was not run.
