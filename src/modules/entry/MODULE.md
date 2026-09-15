# Entry

The cover, and every step of getting into an account: sign in, sign up,
forgotten password, setting a new one, and naming yourself. Plus the sign-in
sheet every other module raises. Screens 1 and 2 of the guest spec; acceptance
criteria M1 §1.2 and M2 part one.

## Public surface

```js
import { Cover, Auth, SignInPrompt } from '../modules/entry';
```

`SignInPrompt` is the piece other modules use: every control a guest can reach
raises it, naming the title and the verb of the control that was tapped.

`Auth` is one component over five steps — `/welcome/signin`, `/welcome/signup`,
`/welcome/forgot`, `/welcome/reset`, `/welcome/username` — because they are not
five features. They are five places the same person can be standing, and each
one has to know where the other four are.

## The three states of "who is this?"

The module reads them from `shared/auth`, and the middle one is the whole
reason the rest of the app stopped lying:

| `status` | what it means | what a screen shows |
| --- | --- | --- |
| `restoring` | the session is being renewed; we do not know yet | the loading state |
| `signed-in` | there is a session | their own content |
| `guest` | there is no session | the guest state |

A returning access token lasts an hour, so a person coming back tomorrow spends
a network round trip in `restoring`. Treating that as `guest` is what put
"Create an account" in front of people who had one. `authReady` is the short
form every screen uses: `authReady && !isSignedIn` is the only correct way to
ask "is this a guest?".

Alongside it, `profileState` answers a second question — `ready`, `missing` or
`error`. `missing` is a real, reachable state (Supabase makes the account, we
make the profile row, and the gap between them can be interrupted) and it is
recoverable. `error` is a network blip and recovers itself. Telling them apart
is what stops a bad connection sending someone to re-choose a username they
already have.

## Rules it carries

- The cover greets a first visit to the front door only. A shared link to a
  title or a person goes straight there; the catalogue is never gated.
- "Just looking around" is remembered, and never asked again.
- A signed-in person never sees the cover or a sign-in form. Both are reachable
  by URL, and both send them on.
- Where someone was when they hit a wall is where they return to after signing
  in — never a generic home, and never back to `/welcome`, which is a loop.
- Sign-ups are by invitation (a database trigger, not a UI rule). Supabase can
  only report that as a bare 500, which `supabase-js` classes as a network
  failure — so the translation is checked before the network case, not after.
- A wrong password and an email with no account get the same answer. Telling
  them apart tells a stranger which emails have accounts here.
- Forgotten-password gets the same answer whether or not the account exists,
  for the same reason.
- The password rules are the server's rules, written where the form can see
  them: eight characters and four character classes, ticked off as you type.
- An account with no username is asked for one, wherever in the app it is.

## Every state, and how to look at one

`docs/foundations.html` §12 numbers 38 states across four screens. 35 of them
are driven by `npm run auth`, which runs the real app against Supabase
responses recorded off this project — no credentials, no network, no test
accounts left behind.

```bash
npm run auth              # 35 cases
npm run auth -- --shots   # and a screenshot of each, to snapshots/auth/
npm run auth -- 26 29     # just those
```

`--shots` is the only way to look at an error state without causing one. The
states that are hard to reach by hand — a revoked refresh token, a 429, a
username collision mid-sign-up, a profile write that failed after the account
was made — each have a numbered case and a photograph.

Three of the 38 are not machine-checked, and each has a reason:

| # | State | Why not |
| --- | --- | --- |
| I10 | Autofilled | Needs a real password manager. The CSS that keeps the ring visible through Chrome's yellow wash is in `entry.css`. |
| I14 | Keyboard open at 320×568 | Needs a device keyboard, not a viewport. |
| C4/C5 | Light theme, reduced motion | Covered by `npm run snap -- entry`, which shoots both themes. |

## Known headroom

- **The action that started it is not replayed.** A guest taps ♥, signs up, and
  lands back on the title with the heart still empty. They return to the right
  page; the thing they were doing does not complete. This is the oldest promise
  in the module — `SignInPrompt` has carried a comment about it since M1 — and
  it is the last thing in entry that is a decision rather than a defect: what
  the title page should *do* on the way back is a design answer.
- **`006_username.sql` is not applied yet.** Until it is, `Raman` and `raman`
  are two different usernames, and a collision is caught after the account is
  created rather than before. The flow handles both; applying it makes the
  better half happen.
- Owner's, in the Supabase dashboard: leaked-password protection, and the
  reset-password redirect URL.

## Seeing it

```bash
npm run auth                     # 35 cases: every way this can go wrong
npm run auth -- --shots          # and a photograph of each state
npm run auth -- --show 15        # what case 15 actually rendered
npm run snap -- entry            # cover / signin / signup / forgot, both themes
npm run snap -- entry --check    # did anything move that shouldn't have?
```
