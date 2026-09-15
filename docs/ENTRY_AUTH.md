# Entry — the authentication pass

2026-09-15. Every case brainstormed, tested and fixed, with the ones left for
the design pass named at the end.

The short version: **the worst bug had nothing to do with signing in.** It
happened to people who were already signed in, and it happened every time they
came back the next day.

---

## The headline

An access token lasts one hour. Come back after that and the app has to spend a
network round trip renewing it before it knows who you are. For that whole
second the code asked `isSignedIn`, got `false`, and acted on it.

Measured, before:

```
signed in, token expired, opening Library
   t= 802ms   [top bar] Sign in
   t=1501ms   Library · Nothing saved yet · An account keeps your watchlist…
              [Create an account]
   t=2501ms   Library · (their actual library)
```

For a second and a half a person with an account was shown a button inviting
them to make one. On a slow connection, longer. That is the failure you were
seeing, and it was never a login failure — it was the app answering "who is
this?" before it knew.

The fix is that "we don't know yet" is now a state the app can be in, and can
say. Three answers, not two: `restoring`, `signed-in`, `guest`. Every screen
that shows a guest something now asks `authReady && !isSignedIn`, and shows its
loading state until then.

After:

```
signed in, token expired, opening Library
   t= 801ms   [top bar]  (held)   Library
   t=1501ms   [top bar] qa        Library · (their actual library)
```

---

## Every case

25 of them, each one an automated check. `npm run auth` runs the lot in about
forty seconds, against the real app, with Supabase's real responses played back
from recordings — no credentials, no network, no test accounts left behind.

### Coming back

| # | Case | Before | Now |
| --- | --- | --- | --- |
| 1 | Token expired, returning | **Told they had no account for 1.5s** | Loading, then their library |
| 2 | Token still valid, reload | Fine | Fine |
| 3 | Refresh token revoked or reused | **Dropped to guest silently** | "Your session ended. Sign in again" |
| 4 | Never signed in | Fine | Fine, and no false alarm |
| 5 | Profile read fails on a blip | Indistinguishable from no profile | Treated as a blip, recovers itself |

### Signing in

| # | Case | Before | Now |
| --- | --- | --- | --- |
| 6 | Both fields empty | **Sent to the server, generic error back** | Named under each field, nothing sent |
| 7 | `abc` typed as the email | **Sent to the server** | Caught here, cursor moved to the field |
| 8 | Wrong password | Handled | Handled — and identical to an unknown email, on purpose |
| 9 | No connection | **"Failed to fetch"** | "Can't reach the server. Check your connection" |
| 10 | Too many attempts | **Raw Supabase text** | "Too many attempts. Wait a minute" |
| 11 | Returning to where you were stopped | Worked | Worked, and now can't loop back to `/welcome` |

### Creating an account

| # | Case | Before | Now |
| --- | --- | --- | --- |
| 12 | Six-character password | **Form allowed it; server demanded eight** | Rules shown and ticked off as you type |
| 13 | Email not on the invitation list | Handled | Handled |
| 14 | Email already registered | Handled | Handled |
| 15 | Username already taken | **Dead end — see below** | Account is kept, one field left to fill |
| 16 | Username taken, asked before signing up | Not possible | Possible once `006` is applied |
| 17 | Account exists with no profile row | **No way out** | Asked for a username, wherever they are |

**Case 15 was the second real bug.** Supabase creates the account; we create the
profile row. If the username was taken, the second half failed — and the person
was left on the sign-up form, *already signed in*, with an error. Pressing the
button again told them their email was already registered. By themselves.
Thirty seconds earlier. There was no way forward and no way back.

Now the account is kept — because it exists, and pretending otherwise is the
whole problem — and the flow asks for the one thing still missing. The same
step catches every other way an account can end up with no name.

### Doors

| # | Case | Before | Now |
| --- | --- | --- | --- |
| 18 | Signed in, opens `/welcome/signin` | **Showed the sign-in form** | Sent on |
| 19 | Signed in, opens `/welcome` | **Showed the cover** | Sent on |
| 20 | `/welcome/pizza` | **Showed sign-in under a meaningless URL** | Redirected |

### Passwords

| # | Case | Before | Now |
| --- | --- | --- | --- |
| 21 | Forgotten password | **Did not exist** | Email a link; same answer either way |
| 22 | Reset link expired | **Did not exist** | Says so, offers a new one |
| 23 | Reading back what you typed | **Not possible** | Show / hide |

### Leaving

| # | Case | Before | Now |
| --- | --- | --- | --- |
| 24 | Signing out | Worked | Worked, and says nothing alarming |
| 25 | Signing out with two tabs open | Other tab **said the session had ended** | Other tab signs out quietly |

Case 25 was found by writing the test, not by reading the code: the other tab
hears "signed out" from Supabase but not *why*, so it assumed the worst.

### Also changed, without a case of its own

- The back arrow used to walk out of the app entirely when the page was opened
  from a link rather than navigated to.
- Error messages are matched on Supabase's **error codes**, not its prose. The
  old mapping matched on wording, so a reworded message would have silently
  become "Something went wrong" — and one branch was already wrong, looking for
  "at least 6" against a server that says eight.
- The invitation-only rejection arrives as a bare HTTP 500, which `supabase-js`
  classes as a network failure. It is now translated before the network case,
  or an invited-only rejection reads as "check your connection".

---

## What needs your design

Two things are deliberately unfinished, because they are decisions rather than
defects:

1. **The action that started it is not replayed.** A guest taps ♥ on a title,
   signs up, and lands back on that title with the heart still empty. They get
   back to the right place; the thing they were doing does not complete. The
   comment promising this has been in `SignInPrompt.jsx` since M1. What should
   the title page *do* when they come back — complete it silently, or show it
   completing? That is a design answer.

2. **The five steps have no designs.** `signup`, `forgot`, `reset` and
   `username` all render through the existing form chrome. They work and they
   are consistent, but only `signin` and `cover` were ever drawn. Screenshots
   of all four are in `snapshots/entry/` for you to draw over.

---

## What needs you, in the Supabase dashboard

1. **Auth → URL Configuration → Redirect URLs** — add the reset-password
   landing page, or the emailed link will refuse to come back:
   - `http://localhost:5173/welcome/reset`
   - `https://<your-vercel-domain>/welcome/reset`
2. **Auth → Password → leaked-password protection** — still off. (Carried over
   from Phase A.)
3. **Auth → Providers → Email → disable email signups** — still on. The
   database trigger already blocks uninvited sign-ups; this is the belt beside
   those braces. (Also carried over from Phase A.)
4. **Run `supabase/006_username.sql`** in the SQL editor. It makes usernames
   case-insensitively unique — today `Raman` and `raman` are two different
   accounts — and lets the sign-up form ask whether a name is free *before*
   creating the account. The flow works without it; applying it makes case 16
   happen instead of case 15.

---

## Checking it yourself

```bash
npm run auth              # all 25 cases
npm run auth -- --show 15 # what case 15 actually rendered
npm run auth -- 1 3 25    # just those
npm run snap -- entry     # screenshots of all four steps, both themes
```
