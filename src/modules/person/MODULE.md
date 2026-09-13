# Person

A person's page: who they are, how much of their work you have seen, and their
filmography by role. Screen 5; acceptance criteria M1 §1.6 and M3 §3.1.

## Public surface

```js
import Person from '../modules/person';
```

## Rules it carries

- Collection progress sits **above** the filmography, not in a stats block. It
  is the differentiator, so it is the first thing on the page.
- The fraction is per role: switching from Director to Writer changes both
  halves, because it is a different body of work.
- Roles are ordered by size, so the largest leads — Director for a director,
  Cast for an actor, Composer for a composer, with no rule for each.
- The denominator excludes credits with no date, unreleased credits, "Self"
  credits (a talk-show appearance is not a film you were in), and anything
  under 200 votes. The page prints how many it removed, which is what makes an
  opinionated number honest.
- A guest sees no bar. "0 of 10 directed" is a real number that happens to be
  a lie about them.

## Known headroom

- The filmography grid renders every tile at once — 131 for Hans Zimmer.
- The design shows a "Year ▾" sort that is not built; sorting and a "seen"
  filter are the obvious next controls.
- Known cost of the 200-vote threshold: Emilia Clarke reads 12 rather than the
  ~20 a viewer would name. Nowhere explains why.
