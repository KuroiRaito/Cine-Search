# Feedback intake — the friends round

**For:** the first rollout to friends on the live site. How feedback gets in,
and how it gets turned into architecture changes rather than a to-do list.

Companion to [`USE_CASES.md`](USE_CASES.md). That document is the 219 things the
product is supposed to do; this one is how a friend's complaint gets matched to
one of them, or recorded as a hole in the design method.

---

## 1 · The channel

**WhatsApp group, plus two small things in the app.** Your instinct was right;
the collection problem you were worried about is solved by an export, not an API.

### Why WhatsApp wins the part that matters

Friends will report the fifth annoyance only if reporting costs nothing. A form
gets the first two complaints from each person and then silence — which means
you get the *loud* problems and lose the *frequent* ones, and the frequent ones
are the product problems. WhatsApp is the only channel where someone types
"this feels weird" at 1am without deciding to file a report first.

That vague category — "feels weird", "I don't get this screen" — is the most
valuable thing in this round and the hardest to collect. Two of your four
questions live entirely inside it.

### How I actually read it

No API, no business account, no integration. You export:

> Group → ⋮ → More → **Export chat** → **Include media**

You get a `.zip` with `_chat.txt` and the images. Save it anywhere in the repo
and tell me the path. The text is timestamped per message with the sender's
name, and screenshots appear as `IMG-…jpg (file attached)` lines I can match to
the file and read.

Limits worth knowing: the export caps at ~10,000 messages when media is
included, iOS and Android format the lines slightly differently (both fine),
and it's a point-in-time snapshot — so export once per round, not continuously.

**Cost to you: one action per round.** That is the whole integration.

### The two things to add to the app first

WhatsApp catches everything but records nothing. "Search is broken" with a
screenshot tells me the symptom and not the screen, the state, the region, or
the build. These close that gap, and both are small:

| | What | Why it changes the analysis |
|---|---|---|
| **1** | **A feedback button** → one sheet, two fields, writes to a new Supabase table | Captures route, auth state, viewport band, region, theme and commit **automatically**. The friend types one sentence; the record arrives with the six facts that make it diagnosable |
| **2** | **The error boundary reports itself** to the same table | Right now `Boundary.jsx` prints the crash id to `console.error` and nothing else. There is no error service — `S4` settled that deliberately. So when a friend sends you a screenshot of `K2F9QX`, **that code currently points at nothing.** This makes it point at a stack trace and a route |

Item 2 is the one I'd insist on. You are about to put a live app in front of
people with no way to see a crash they hit. The first "it just went white" is
otherwise unanswerable.

Both write through a `SECURITY DEFINER` RPC like every other write in this
product, and I read the table directly. Guest reports work too — no account
needed to complain.

### And one thing that isn't a channel

**Watch two of them use it, on a call, for fifteen minutes.** Say nothing while
they do. "What feels unnatural" is the question people cannot answer about
themselves and that you can see in four seconds — a hesitation before a tap, a
back button, a reread. You have roughly five friends in this round, which is
exactly the scale where this works and the only time it ever will.

### What I ruled out, and why

| Option | Verdict |
|---|---|
| **Google Form** | Zero build, structured fields, native screenshot upload. Fallback if you'd rather not build anything — but response rate collapses after the first two items, and it captures no context |
| **GitHub Issues** | Perfect for me, non-starter for them. Nobody makes an account to tell a friend his app is broken |
| **Telegram / Discord** | Readable bot API, genuinely better plumbing — but moving five friends to a new app costs more than your one export does |
| **Sentry / PostHog** | The real answer for crashes, and PostHog's session replay would answer "what feels unnatural" better than anything else here. **But** `SH7` is a settled principle in this product: you removed `ipapi.co` specifically to stop sending user data to a company with no relationship to the product, with no consent and nothing disclosed. A friends round is the one case where consent is actually available — these people know they're testing. Worth revisiting **as a decision**, not as a default |

---

## 2 · What to ask them

Your four questions are the right four — but they are **your** categories, not
theirs. Asked directly, each one asks a friend to diagnose:

- *"What are the bugs?"* → they report only hard failures, and call slow things bugs
- *"What gap are you facing?"* → almost nobody can name an absence
- *"What feels unnatural?"* → the honest answer is "I don't know, it just did"
- *"What feels bad?"* → gets you tone, not location

Ask them to **narrate instead**, and let me do the sorting. Two questions:

> **1. What were you trying to do, and what happened instead?**
> **2. Anything that annoyed you, even slightly, even if you can't say why?**

Question 1 is the one that makes root-cause possible. "Search is broken" links
to nothing. "I was looking for Sholay, typed *sholey*, got nothing" links to
`E14` → rung 5 unbuilt → the rescue ladder has no typo dictionary. Same
complaint, one is a line item and the other is an architecture decision.

Question 2 exists because the best signal in this round is the thing they'd
otherwise think wasn't worth mentioning.

**Tell them not to batch it.** One message per thing, when it happens. A list
written on Sunday evening is a list of the things memorable enough to survive
until Sunday, which is the wrong filter.

---

## 3 · How a complaint becomes a record

Every item gets one row. I build these from the export; you don't write them.

```
ID        F-01
Who       Priya · Android · Mumbai · signed in
Said      "it doesn't find sholay"  (+ IMG-20261106-WA0003.jpg)
Doing     looking for a film by name, typed "sholey"
Case      E14            ← a use-case id from USE_CASES.md, or NEW
Class     unbuilt        ← the taxonomy below
Severity  blocks / annoys / notices
Count     4 people       ← dedup across the group happens here
```

The **Case** field is the whole trick. Because the register already has 219 ids,
most complaints resolve to an id the moment they're read — and the ones that
*don't* are the most interesting rows in the table, because they mean the design
never considered it.

---

## 4 · The cause taxonomy

Symptoms cluster uselessly; causes cluster into fixes. Six classes, and each one
has a different lesson attached:

| Class | Means | The fix | The architectural lesson |
|---|---|---|---|
| **Unbuilt** | The register predicted it — one of the 12 or the 9 partials | Build it | None. The design was right and the backlog was honest |
| **Misbuilt** | Code disagrees with its own design doc | Correct the code | **A gate failed.** Which check, harness rule or fingerprint should have caught it, and why didn't it run? |
| **Mis-designed** | Built exactly as specified, and the specification is wrong | Change the doc, then the code | **Name the assumption that was wrong.** The most valuable class in the set — this is the only one that teaches you something about users |
| **Unanticipated** | No use-case id covers it | Add the id, then build | **The design method has a blind spot.** Which of the 13 journeys, and what kind of thinking would have found it? |
| **Upstream** | A TMDB or Supabase limit | Usually can't fix | Was it **known and undisclosed**? A known limit the interface doesn't admit to is our bug, not TMDB's |
| **Environmental** | Their device, network or region | Reproduce or park | Does the product degrade honestly there? |

The split that matters most is **Misbuilt vs Mis-designed**. They produce
identical complaints and opposite responses: one means the pipeline leaked, the
other means the thinking was wrong. Conflating them is how teams fix the same
class of problem forever.

---

## 5 · Linking it back to the system

This is the part you asked for — stopping the *class* of issue, not the issue.

**The rule:** any cause class with three or more items gets one question asked of
it — *what gate would have caught every one of these?* The answer is always one
of six things, and the last one is the interesting one:

1. A `verify` check (16 exist)
2. A harness rule (`find` 87 · `cohorts` 60 · `auth` 38)
3. A `snap` fingerprint
4. A state row in a module document
5. A row in `USE_CASES.md`
6. **Nothing. No gate of any kind exists for this.**

A cluster landing on 6 is an architecture change, and that's what you're
actually hunting. A cluster landing on 1–5 means the gate exists and didn't
run — which is a process fix, and usually a cheaper one.

### One systemic cause I can already name, before any feedback arrives

**Your behavioural harnesses don't run in CI.** `verify`, `build` and
`test:api` run on every push. `find` (87 rules), `cohorts` (60 cases) and
`auth` (38 cases) do not — they run when someone remembers to run them.

That's **185 assertions about product behaviour** sitting outside the gate,
covering precisely the three areas friends are most likely to complain about:
search quality, series progress, and sessions. If this round produces a cluster
of **Misbuilt** items, this is where it will come from, and I can tell you that
now rather than discovering it in the analysis.

It's also the cheapest thing on this page to fix.

---

## 6 · Order of operations

| | | Why here |
|---|---|---|
| **1** | Wire the three harnesses into CI | Cheapest systemic fix available; do it before you add code, not after |
| **2** | Error boundary reports to Supabase | Otherwise the first crash is unanswerable |
| **3** | Feedback button | Turns "search is broken" into a diagnosable record |
| **4** | Your bare-minimum fixes | Name them and I'll do them — but see the note below |
| **5** | Ship, open the group, set the two questions | — |
| **6** | Watch two friends for fifteen minutes | Only works at this scale. Don't skip it |
| **7** | Export, and I build the table and the analysis | — |

**On step 4** — you said you'd fix what's bending before rolling out. Worth
checking the list against `USE_CASES.md` first: of the 36 non-green rows there,
most are *absences* rather than defects, and an absence a friend discovers is
worth more as feedback than as a fix. Fix what makes the product feel broken;
leave what makes it feel incomplete, and let them tell you which incompleteness
they actually noticed.

That distinction is also the cheapest way to find out whether the register's
twelve priorities are in the right order — they're my ranking, and five friends
disagreeing with it is better information than my reasoning.
