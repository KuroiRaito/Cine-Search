# Entry

The cover, sign in, sign up, and the sign-in sheet. Screens 1 and 2 of the
guest spec; acceptance criteria M1 §1.2 and M2 part one.

## Public surface

```js
import { Cover, Auth, SignInPrompt } from '../modules/entry';
```

`SignInPrompt` is the piece other modules use: every control a guest can reach
raises it, naming the title and the verb of the control that was tapped.

## Rules it carries

- The cover greets a first visit to the front door only. A shared link to a
  title or a person goes straight there; the catalogue is never gated.
- "Just looking around" is remembered, and never asked again.
- Where someone was when they hit a wall is where they return to after signing
  in — not a generic home.
- Sign-ups are by invitation (a database trigger, not a UI rule). The error is
  translated here into a sentence a person can act on.

## Known headroom

Complete as designed. The one open item is the owner's: leaked-password
protection in Supabase Auth.
