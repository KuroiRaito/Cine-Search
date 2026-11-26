#!/usr/bin/env node
/**
 * Design-system verification, from the build contract's "how shape drifts, and
 * how to stop it".
 *
 * These are the checks that catch drift statically — no browser, no dev server,
 * so they can gate CI and cost nothing to run before every commit. The one that
 * matters most is the first: it is exactly the failure that shipped a `.card`
 * referenced in five places with no rule behind it, so every card in the app
 * lost its background, padding, radius and margin at once.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// fileURLToPath, not .pathname: this repo lives under a directory with a space
// in its name, and .pathname hands back the percent-encoded form.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

const files = walk(SRC);
const jsx = files.filter((f) => ['.jsx', '.js'].includes(extname(f)));
const cssFiles = files.filter((f) => extname(f) === '.css');
const css = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

const failures = [];
const fail = (check, detail) => failures.push({ check, detail });

/* ---------------------------------------------------------------
   1. Every class in the markup resolves to a rule that sets shape.
   A class that only sets typography on top of a base that doesn't
   exist is the most common way a component silently loses its box.
   --------------------------------------------------------------- */
const SHAPE_PROPS = new Set([
    'background', 'background-color', 'background-image', 'padding', 'padding-left',
    'padding-inline', 'padding-top', 'margin', 'margin-inline', 'margin-top', 'border',
    'border-radius', 'border-left', 'border-top', 'width', 'height', 'min-height',
    'display', 'flex', 'grid-template-columns', 'grid-column', 'position', 'gap',
    'aspect-ratio', 'object-fit', 'opacity', 'transform', 'inset', 'color', 'font-size',
    'min-width', 'margin-bottom', 'padding-bottom',
    // A cap is a shape: `max-height` is what makes the picker sheet scroll
    // instead of growing past the viewport, and `max-width` is what holds a
    // form at --form-max. Neither was in this list, so a rule that set only
    // one of them read as a rule that set nothing.
    'max-height', 'max-width',
]);

const defined = new Set();
const shaped = new Set();
for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const props = new Set([...m[2].matchAll(/([a-z-]+)\s*:/g)].map((p) => p[1]));
    // A class that only sets custom properties is still doing something: the
    // watch-state tones (.st-want, .st-ing, …) carry a hue into whatever they
    // are applied to, and the rules that consume it live on the component. That
    // is the intended pattern, not a class that forgot to do anything.
    const carriesTokens = [...props].some((p) => p.startsWith('--'));
    const setsShape = carriesTokens || [...props].some((p) => SHAPE_PROPS.has(p));
    for (const c of m[1].matchAll(/\.([A-Za-z][\w-]*)/g)) {
        defined.add(c[1]);
        if (setsShape) shaped.add(c[1]);
    }
}

const used = new Map();
for (const f of jsx) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        for (const tok of (m[1] || m[2] || '').split(/[\s${}?:()'"]+/)) {
            if (/^[a-z][\w-]*$/.test(tok) && !used.has(tok)) used.set(tok, relative(ROOT, f));
        }
    }
}

for (const [cls, where] of used) {
    // Interpolated ternaries leak JS identifiers into this scan; only flag a
    // token if some rule mentions it or it looks like a real class name.
    if (!defined.has(cls) && /-/.test(cls)) fail('undefined-class', `.${cls} used in ${where}, no CSS rule`);
    else if (defined.has(cls) && !shaped.has(cls)) fail('shapeless-class', `.${cls} has rules but none set shape (${where})`);
}

/* ---------------------------------------------------------------
   2. No raw colour in components. Anything hard-coded cannot follow
   the light/dark token swap, which is how v0.1 components ended up
   theme-proof.
   --------------------------------------------------------------- */
for (const f of jsx) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        fail('raw-colour', `${m[0]} in ${relative(ROOT, f)} — use a token`);
    }
}

/* ---------------------------------------------------------------
   3. One gutter, obeyed by everything. A literal horizontal inset
   that matches a breakpoint value is a block giving itself its own
   number.
   --------------------------------------------------------------- */
for (const f of cssFiles) {
    const text = readFileSync(f, 'utf8');
    text.split('\n').forEach((line, i) => {
        if (/^\s*(--gutter|@media)/.test(line)) return;
        if (/(padding-inline|margin-inline)\s*:\s*(14|24|40)px/.test(line)
            || /\b(padding|margin)\s*:[^;]*\b(14|24|40)px\s*;/.test(line) === false
            && /\b(padding|margin)\s*:\s*\S+\s+(14|24|40)px\b/.test(line)) {
            fail('hardcoded-gutter', `${relative(ROOT, f)}:${i + 1} — ${line.trim().slice(0, 60)}`);
        }
    });
}

/* ---------------------------------------------------------------
   4. Every custom property used is defined somewhere.
   --------------------------------------------------------------- */
const declared = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
for (const m of css.matchAll(/var\((--[\w-]+)/g)) {
    if (!declared.has(m[1])) fail('undefined-token', `var(${m[1]}) is never declared`);
}


/* ---------------------------------------------------------------
   5. No inline styles, except the one primitive whose API is dimensional.
   A `style={{ marginTop: 16 }}` is a number outside the design contract
   that none of the checks above can see. Values that are genuinely
   data-driven — a progress bar's width, a poster's background image — are
   allowed, and only those: the property must be one that carries data, and
   the value must be an expression rather than a literal.
   --------------------------------------------------------------- */
const DYNAMIC_OK = new Set(['width', 'height', 'backgroundImage', 'aspectRatio', 'transform']);
for (const f of jsx) {
    if (f.endsWith('Skeleton.jsx')) continue;
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
        const line = text.slice(0, m.index).split('\n').length;
        // Template literals and ${} carry expressions; collapse them so the
        // property split below does not trip on the commas inside.
        const body = m[1].replace(/`[^`]*`/g, 'EXPR').replace(/\$\{[^}]*\}/g, 'EXPR');
        for (const prop of body.split(',')) {
            const kv = prop.match(/^\s*([A-Za-z]+)\s*:\s*(.+?)\s*$/);
            if (!kv) continue;
            const [, key, value] = kv;
            const literal = /^(\d+|'[^']*'|"[^"]*")$/.test(value);
            if (!DYNAMIC_OK.has(key) || literal) {
                fail('inline-style', `${relative(ROOT, f)}:${line} — ${key}: ${value.slice(0, 30)}`);
            }
        }
    }
}

/* ---------------------------------------------------------------
   6. A module's own classes belong to that module.

   A class a module INTRODUCES may be used only by that module. A class the
   shared layer already defines is not introduced — a module is free to scope
   one inside its own element (`.tside .prow`), which is styling its own
   composition, not claiming someone else's primitive.

   The class names stay the design system's own. That is what makes per-module
   stylesheets safe without renaming anything, and it is why this check exists
   rather than CSS Modules.
   --------------------------------------------------------------- */
const moduleOf = (f) => relative(ROOT, f).match(/^src\/modules\/([^/]+)\//)?.[1] ?? null;
const classesIn = (file) => {
    const found = new Set();
    for (const m of readFileSync(file, 'utf8').matchAll(/([^{}]+)\{[^}]*\}/g)) {
        // Strip at-rule preludes: @media's condition is not a selector.
        if (m[1].trim().startsWith('@')) continue;
        for (const c of m[1].matchAll(/\.([A-Za-z][\w-]*)/g)) found.add(c[1]);
    }
    return found;
};

const sharedClasses = new Set();
for (const f of cssFiles) if (!moduleOf(f)) for (const c of classesIn(f)) sharedClasses.add(c);

const owner = new Map();
for (const f of cssFiles) {
    const mod = moduleOf(f);
    if (!mod) continue;
    for (const c of classesIn(f)) {
        if (sharedClasses.has(c)) continue;          // scoping a shared class: fine
        const prev = owner.get(c);
        if (prev && prev !== mod) fail('class-ownership', `.${c} is introduced by both ${prev} and ${mod}`);
        owner.set(c, mod);
    }
}
for (const f of jsx) {
    const mod = moduleOf(f);
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        for (const tok of (m[1] || m[2] || '').split(/[\s${}?:()'"]+/)) {
            const o = owner.get(tok);
            if (o && o !== mod) fail('class-ownership', `.${tok} belongs to ${o}, used in ${relative(ROOT, f)}`);
        }
    }
}

/* ---------------------------------------------------------------
   7. Modules are imported only through their public surface.
   From outside src/modules/<m>/, the only importable path is the module
   itself (its index.js). Reaching into a module's internals is what makes
   it stop being a module.
   --------------------------------------------------------------- */
import { dirname, resolve as resolvePath } from 'node:path';
for (const f of jsx) {
    const mod = moduleOf(f);
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*'(\.\.?\/[^']+)'/g)) {
        const target = relative(ROOT, resolvePath(dirname(f), m[1])).replace(/\\/g, '/');
        const tm = target.match(/^src\/modules\/([^/]+)(?:\/(.*))?$/);
        if (!tm || tm[1] === mod) continue;
        const inside = tm[2] ?? '';
        if (inside && inside !== 'index.js') {
            fail('deep-import', `${relative(ROOT, f)} imports ${target} — use modules/${tm[1]}`);
        }
    }
}

/* --------------------------------------------------------------- */

/* ---------------------------------------------------------------
   9. Lengths in a converted module come from the scale.

   This is the rule that makes the rest hold. The thirty distinct font
   sizes did not arrive through carelessness — they arrived because
   nothing rejected them.

   Scoped to modules that have been converted. Adding a module here is
   the last step of converting it, so this list is also the migration
   board: what is listed is on the scale and stays there.
   --------------------------------------------------------------- */
const CONVERTED = ['entry', 'profile', 'title', 'person'];

/* Three raw lengths are legal, and each is legal for a stated reason rather
   than because it was hard to convert:

   320px   the viewport floor. §08 names it — the iPhone SE and Android Go
           report it — and it is the same kind of value as a breakpoint, which
           CSS already forces to be literal.
   1px     the visually-hidden idiom (.vh). A 1×1 box with a -1px margin is the
           clipping rectangle every screen-reader utility uses; snapping it to
           the 4px grid would make it a 4px box, which is visible. */
const LEGAL_RAW = new Set(['320px', '1px', '-1px']);

// Properties where a raw length is drift. Container caps (max-width) and
// optical values with no scale (blur radii) are deliberately not here.
const SCALED_PROPS = /^(padding|padding-[a-z]+|margin|margin-[a-z]+|gap|row-gap|column-gap|font-size|line-height|border-radius|height|min-height|width|min-width|top|right|bottom|left|inset)$/;

const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');

for (const f of cssFiles) {
    const rel = relative(ROOT, f);
    /* The shared layer is always checked, and that is the point.
       .btn, .searchbox, .tile and .chip live in src/shared/ui — every module
       draws with them — so a module can be fully on the scale and still not
       line up. When this was first switched on, shared/ui and app/shell held
       154 off-scale lengths between them. */
    const mod = rel.match(/src\/modules\/([^/]+)\//)?.[1] ?? 'shared';
    if (mod !== 'shared' && !CONVERTED.includes(mod)) continue;

    const body = stripComments(readFileSync(f, 'utf8'));
    // Blank out media preludes: breakpoints are the one place a raw number is legal.
    const scannable = body.replace(/@media[^{]*/g, '@media ');

    for (const d of scannable.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)) {
        const [, prop, value] = d;
        if (!SCALED_PROPS.test(prop)) continue;
        // `width: 100%`, `height: auto`, `min-height: 100dvh` are all fine.
        for (const px of value.matchAll(/(-?\d*\.?\d+)px/g)) {
            if (px[1] === '0') continue;
            if (LEGAL_RAW.has(px[0])) continue;
            fail('token-scale', `${rel}: ${prop}: ${value.trim()} — ${px[0]} is not on the scale`);
        }
    }
}

/* ---------------------------------------------------------------
   10. The gutter steps with the bands, and only with the bands.

   --gutter used to step at 700 and 1100 while components reflowed at
   760 and 1120, so 700-759 and 1100-1119 wore one band's gutter around
   the other band's layout. That is what the visible stretching was.
   A component may still carry its own content-driven ladder — the rail
   tile's 400/600/1120 is deliberate — but the page gutter may not.
   --------------------------------------------------------------- */
const BANDS = ['600', '1120'];
const gutterSteps = [];
for (const m of stripComments(css).matchAll(/@media[^{]*\(min-width:\s*(\d+)px\)[^{]*\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
    if (/--gutter\s*:/.test(m[2])) gutterSteps.push(m[1]);
}
for (const w of gutterSteps) {
    if (!BANDS.includes(w)) fail('gutter-bands', `--gutter steps at ${w}px, which is not a band (${BANDS.join(', ')})`);
}
for (const b of BANDS) {
    if (!gutterSteps.includes(b)) fail('gutter-bands', `no --gutter step at the ${b}px band`);
}

// --shell-max is the other half of the same decision: a container and its
// inset. It steps once more than the gutter does, at the wide band, where the
// container caps and the margin takes the rest.
const CONTAINER_STEPS = ['1120', '1440'];
const shellSteps = [];
for (const m of stripComments(css).matchAll(/@media[^{]*\(min-width:\s*(\d+)px\)[^{]*\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
    if (/--shell-max\s*:/.test(m[2])) shellSteps.push(m[1]);
}
for (const w of shellSteps) {
    if (!CONTAINER_STEPS.includes(w)) fail('gutter-bands', `--shell-max steps at ${w}px, which is not a container step (${CONTAINER_STEPS.join(', ')})`);
}
for (const b of CONTAINER_STEPS) {
    if (!shellSteps.includes(b)) fail('gutter-bands', `no --shell-max step at the ${b}px band`);
}

/* ---------------------------------------------------------------
   11. A control that sets a background sets a colour.

   A <button> with a background and no colour falls back to the user
   agent's `buttontext`, which is black — invisible on a dark surface.
   This shipped once, on .n-pchip, and was found by a screenshot rather
   than by anything that could have caught it earlier.
   --------------------------------------------------------------- */
for (const f of cssFiles) {
    const rel = relative(ROOT, f);
    for (const m of stripComments(readFileSync(f, 'utf8')).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const sel = m[1].trim();
        const props = m[2];
        if (!/(^|[\s,>+~])(button|input|select|textarea)\b/.test(sel)) continue;
        if (/:(hover|focus|active|disabled|focus-visible)/.test(sel)) continue;
        const hasBg = /(^|;|\s)background(-color)?\s*:/.test(props);
        const hasColor = /(^|;|\s)color\s*:/.test(props);
        if (hasBg && !hasColor) fail('control-colour', `${rel}: \`${sel}\` sets a background with no colour`);
    }
}

/* ---------------------------------------------------------------
   12. Focus is never removed without being replaced.
   A keyboard user who cannot see where they are cannot use the form.
   --------------------------------------------------------------- */
for (const f of cssFiles) {
    const rel = relative(ROOT, f);
    for (const m of stripComments(readFileSync(f, 'utf8')).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const [, sel, props] = m;
        if (!/outline\s*:\s*(none|0)\b/.test(props)) continue;
        // An inset box-shadow ring is the replacement pattern here — .searchbox
        // swaps its outline for one so the control does not change size on focus.
        if (/box-shadow\s*:/.test(props) || /border\s*:/.test(props)) continue;
        /* This check exists for CONTROLS: a keyboard user who cannot see which
           button they are on cannot use the form. `tabindex="-1"` is the
           opposite case -- focusable but not a tab stop, which is what a page
           heading is given so a route change can be announced. You never
           arrive there by aiming, so a ring says "you are on a control" about
           something that is not one. Suppressing it is the fix, not the
           violation. */
        if (/\[tabindex=["']?-1/.test(sel)) continue;
        fail('focus-ring', `${rel}: \`${sel.trim()}\` removes the outline and draws nothing in its place`);
    }
}

/* ---------------------------------------------------------------
   13. Five layers, and nothing between them.
   --------------------------------------------------------------- */
for (const f of cssFiles) {
    const rel = relative(ROOT, f);
    for (const m of stripComments(readFileSync(f, 'utf8')).matchAll(/z-index\s*:\s*([^;}]+)/g)) {
        const v = m[1].trim();
        if (/^var\(--z-/.test(v) || v === 'auto') continue;
        // Single digits are local stacking inside one component's own positioned
        // context — the cover's scrim above its mosaic, below its copy. The app's
        // shared layers start at 10, and those must be tokens.
        if (/^[0-9]$/.test(v)) continue;
        fail('layer-token', `${rel}: z-index: ${v} — shared layers are tokens (--z-sticky/--z-nav/--z-scrim/--z-toast/--z-top); only 0-9 may be local`);
    }
}

/* ---------------------------------------------------------------
   14. An icon is a component, never a character.

   Every icon in this product used to be a Unicode glyph borrowed from
   whatever block had roughly the right shape — twenty of them, across
   five unrelated blocks. Painted at one 100px font size they ranged
   from 10px to 86px tall and their optical centres drifted 48px, which
   is why nothing ever lined up. The search icon was U+2315 TELEPHONE
   RECORDER, painting 44px beside a discover icon painting 86.

   Without this rule the next person needing an icon in a hurry types a
   character that looks about right, and in six months there are twenty
   again. Prose keeps its typography: this only fires on a short text
   node, which is what an icon-as-character always is.
   --------------------------------------------------------------- */
const ICON_GLYPH = /[←-⇿⌀-⏿■-◿☀-➿]/u;

for (const f of jsx) {
    const rel = relative(ROOT, f);
    if (rel.endsWith('shared/ui/Icon.jsx')) continue;   // the map itself may name them
    const body = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')               // block comments are prose
        .replace(/^\s*\/\/.*$/gm, '');                  // and so are line comments
    // a JSX text node: >…< with no tag inside
    for (const m of body.matchAll(/>([^<>{}]{1,3})</g)) {
        const t = m[1].trim();
        if (t && ICON_GLYPH.test(t)) {
            fail('icon-component', `${rel}: “${t}” is a character used as an icon — use <Icon name="…" />`);
        }
    }
    // and the same thing hidden in a short string literal
    for (const m of body.matchAll(/'([^']{1,3})'/g)) {
        if (ICON_GLYPH.test(m[1])) {
            fail('icon-component', `${rel}: '${m[1]}' is a character used as an icon — use a role name and <Icon />`);
        }
    }
}

/* ---------------------------------------------------------------
   15. A component used is a component imported.

   ESLint cannot do this one. Its core scope analysis does not treat a
   JSX element name as a reference, which is why `no-unused-vars` here
   carries `varsIgnorePattern: '^[A-Z_]'` — capitalised imports would
   otherwise all read as unused. The same blindness means a capitalised
   name used and never imported is invisible, and `vite build` is happy
   too: it is a valid identifier that simply is not there.

   It reached main. #58 swept Discover onto <Icon> without adding the
   import, and every visit to the home screen threw
   "ReferenceError: Icon is not defined" — past lint, past the build,
   past a green CI.
   --------------------------------------------------------------- */
for (const f of jsx) {
    const rel = relative(ROOT, f);
    const body = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

    // Names this file brings in or declares itself.
    const known = new Set(['React', 'Fragment']);
    for (const m of body.matchAll(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/g)) {
        for (const n of m[1].matchAll(/[A-Za-z_$][\w$]*/g)) known.add(n[0]);
    }
    for (const m of body.matchAll(/(?:function|class)\s+([A-Z][\w$]*)/g)) known.add(m[1]);
    for (const m of body.matchAll(/(?:const|let|var)\s+([A-Z][\w$]*)\s*=/g)) known.add(m[1]);
    /* A polymorphic component takes its tag as a prop: `{ as: As = 'button' }`
       renders <As>, which is a destructured local, not a missing import. The
       alias is what makes it capitalised, because JSX reads a lowercase tag
       as an HTML element. Only the renaming form counts -- a bare `{ As }`
       would already be caught by the import scan above. */
    for (const m of body.matchAll(/\b[a-z][\w$]*\s*:\s*([A-Z][\w$]*)\s*(?:=|[,}])/g)) known.add(m[1]);

    const seen = new Set();
    for (const m of body.matchAll(/<([A-Z][\w$]*)[\s/>]/g)) {
        const name = m[1];
        if (known.has(name) || seen.has(name)) continue;
        seen.add(name);
        fail('component-import', `${rel}: <${name}> is used but never imported or defined here`);
    }
}

// Aggregate last, after every check has run — a map built before a check
// reports into it is a check that can never fail.
/* ---------------------------------------------------------------
   16. An icon names a role the set actually has.

   Check 14 stops an icon being a character and check 15 stops it being
   used without an import. Neither notices <Icon name="right" />, where
   the role is simply not in the map — the component renders nothing and
   the page looks fine until somebody goes looking for the chevron that
   is not there. The set calls that one `forward`.

   Roles are a small closed vocabulary, so a typo is the likeliest way to
   get one wrong, and a silently empty box is the worst way to find out.
   --------------------------------------------------------------- */
const iconSrc = readFileSync(join(ROOT, 'src/shared/ui/Icon.jsx'), 'utf8');
const mapBody = iconSrc.match(/const\s+ICONS\s*=\s*\{([\s\S]*?)\n\};/);
const ROLES = new Set(
    [...(mapBody?.[1] ?? '').matchAll(/(?:^|[,{\s])([a-zA-Z][\w-]*)\s*:/g)].map((m) => m[1]),
);
/* A check that cannot find what it checks must say so. The first version of
   this guarded on `if (ROLES.size)` and named the map wrong, so it read zero
   roles, skipped every file, and reported ok — which is precisely the silent
   pass it was written to stop. */
if (!ROLES.size) {
    fail('icon-name', 'could not read the role map out of src/shared/ui/Icon.jsx');
}
for (const f of jsx) {
    const rel = relative(ROOT, f);
    if (rel.endsWith('shared/ui/Icon.jsx')) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(/<Icon\b[^>]*?\bname=\{?["']([\w-]+)["']/g)) {
        if (ROLES.size && !ROLES.has(m[1])) {
            fail('icon-name', `${rel}: <Icon name="${m[1]}" /> — no such role in the set`);
        }
    }
}

/* ---------------------------------------------------------------
   17. A box that holds an icon beside something else lays it out.

   `.icon` is `display: block`, deliberately — it is what gives every
   icon a predictable box instead of a baseline to argue with. The
   cost is that a block child inside a block or inline parent takes a
   line of its own and pushes its sibling onto the next one. Nothing
   warns you: the markup reads fine, the stylesheet reads fine, and
   the two are only wrong together.

   That shipped three times. `.chip` put the close cross under the
   word the moment you applied a filter and grew the chip from 32px
   to 48px. `.score-badge` put the number under the star on every
   poster in the product, 36px tall where 20 was drawn. `.sc` did the
   same to an episode's score. One of them had already been noticed
   and answered in the module layer with `vertical-align: middle`,
   which cannot move a block box and never did — a fix that reads
   like a fix is worse than no fix, because it closes the question.

   This does not ban stacking. `.tab-item` stacks its icon over its
   label and says so with `flex-direction: column`. It bans stacking
   that nobody chose: hold an icon next to other content and you
   declare a flex or grid context, and thereby say which way you
   meant it to run.
   --------------------------------------------------------------- */
const FLEXY = new Set(['flex', 'inline-flex', 'grid', 'inline-grid']);
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'path', 'circle', 'rect', 'use']);

/* Every display a class is ever given, by the last element of each selector —
   `.eprow .ed .sc { display: inline-flex }` is what gives `.sc` its row. All of
   them, not the last one seen, so a rule inside a media query cannot make a
   class look shapeless to this check. */
const displaysOf = new Map();
for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const d = /(?:^|[;{\s])display\s*:\s*([a-z-]+)/.exec(m[2]);
    if (!d) continue;
    for (const sel of m[1].split(',')) {
        const parts = sel.trim().split(/[\s>+~]+/).filter(Boolean);
        const name = /^\.([A-Za-z0-9_-]+)/.exec(parts[parts.length - 1] || '');
        if (!name) continue;
        if (!displaysOf.has(name[1])) displaysOf.set(name[1], new Set());
        displaysOf.get(name[1]).add(d[1]);
    }
}

/* A tag stack rather than a regex: the question is which element an <Icon> is a
   DIRECT child of, and a regex cannot tell that from an icon six levels down.
   Attribute scanning tracks quotes and brace depth, because `onClick={() =>
   onChange({ ...facets })}` carries both a nested brace and no `>` of its own. */
function directChildren(src) {
    const done = [];
    const stack = [];
    const addText = (t) => {
        if (!stack.length) return;
        const clean = t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').trim();
        if (clean && !/^[{}()?:&|\s]*$/.test(clean)) stack[stack.length - 1].text += ' ' + clean;
    };
    let i = 0;
    while (i < src.length) {
        const lt = src.indexOf('<', i);
        if (lt < 0) break;
        const open = /^<(\/?)([A-Za-z][\w.]*)/.exec(src.slice(lt, lt + 64));
        if (!open) { i = lt + 1; continue; }
        addText(src.slice(i, lt));
        let j = lt + open[0].length, depth = 0, quote = null, selfClose = false;
        for (; j < src.length; j++) {
            const ch = src[j];
            if (quote) { if (ch === quote) quote = null; continue; }
            if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            else if (ch === '>' && depth === 0) { selfClose = src[j - 1] === '/'; break; }
        }
        const tag = open[2];
        if (open[1]) {
            for (let k = stack.length - 1; k >= 0; k--) {
                if (stack[k].tag !== tag) continue;
                while (stack.length > k + 1) done.push(stack.pop());
                const node = stack.pop();
                done.push(node);
                if (stack.length) stack[stack.length - 1].kids.push(tag);
                break;
            }
        } else {
            const attrs = src.slice(lt + open[0].length, selfClose ? j - 1 : j);
            if (selfClose || VOID_TAGS.has(tag)) {
                if (stack.length) stack[stack.length - 1].kids.push(tag);
            } else {
                stack.push({ tag, attrs, kids: [], text: '', at: src.slice(0, lt).split('\n').length });
            }
        }
        i = j + 1;
    }
    while (stack.length) done.push(stack.pop());
    return done;
}

/* Only string literals: `{finding ? 'chips aside' : 'chips'}` names two classes
   and an identifier, and the identifier is not one. */
function classesOf(attrs) {
    const k = attrs.indexOf('className=');
    if (k < 0) return [];
    let p = k + 'className='.length;
    if (attrs[p] === '"' || attrs[p] === "'") {
        const end = attrs.indexOf(attrs[p], p + 1);
        return attrs.slice(p + 1, end).split(/\s+/).filter(Boolean);
    }
    if (attrs[p] !== '{') return [];
    let d = 0, q = null, e = p;
    for (; e < attrs.length; e++) {
        const ch = attrs[e];
        if (q) { if (ch === q) q = null; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
        if (ch === '{') d++;
        else if (ch === '}' && --d === 0) break;
    }
    const inner = attrs.slice(p + 1, e).replace(/\$\{[^}]*\}/g, ' ');
    return [...inner.matchAll(/['"`]([^'"`]*)['"`]/g)]
        .flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
}

for (const f of jsx) {
    const rel = relative(ROOT, f);
    if (rel.endsWith('shared/ui/Icon.jsx')) continue;
    for (const node of directChildren(readFileSync(f, 'utf8'))) {
        if (!node.kids.includes('Icon')) continue;
        const besideIt = node.text.trim() || node.kids.filter((k) => k !== 'Icon').join(', ');
        if (!besideIt) continue;                       // an icon on its own has nothing to collide with
        const classes = classesOf(node.attrs);
        if (!classes.length) continue;                 // no class, no rule this check can name
        const laysOut = classes.some((c) => [...(displaysOf.get(c) || [])].some((d) => FLEXY.has(d)));
        if (laysOut) continue;
        fail('icon-row', `${rel}:${node.at}: .${classes[0]} holds <Icon> beside other content but declares no flex or grid context`);
    }
}

/* ---------------------------------------------------------------
   18. The specification and the code agree on every token.

   docs/design-system.html is the Projector specification -- what the design
   SAYS. src/shared/theme/tokens.css is what the product DOES. They share 84
   custom properties, and as of today every one of them matches.

   That is worth a check rather than a note, because the failure is silent and
   expensive: a developer agent reads the spec, builds to a value the code no
   longer holds, and nobody finds out until it is on screen. Neither file is
   wrong in that situation -- they just stopped being the same file, and no
   human reads 162 tokens across two documents to notice.

   One level of `var()` is resolved before comparing, because the code
   legitimately aliases where the spec states a literal: `--sh: var(
   --shadow-raised)` and `--sh: 0 6px 16px -4px rgba(0,0,0,.6)` are the same
   shadow said two ways. Inline `style="--c: ..."` in the spec's own demo
   markup is not a token and is not read -- only its <style> blocks are. */
{
    const specFile = join(ROOT, 'docs/design-system.html');
    if (existsSync(specFile)) {
        const html = readFileSync(specFile, 'utf8');
        /* <style> blocks only. An inline style attribute in a demo is local
           to that demo, not a declaration about the system. */
        const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
        const tokensCss = readFileSync(join(ROOT, 'src/shared/theme/tokens.css'), 'utf8');

        const declsOf = (css) => {
            const out = new Map();
            for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
                if (!out.has(m[1])) out.set(m[1], m[2].trim());
            }
            return out;
        };
        const deref = (map, v, depth = 0) => {
            if (depth > 4) return v;
            const m = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(v.trim());
            return m && map.has(m[1]) ? deref(map, map.get(m[1]), depth + 1) : v.trim();
        };

        const S = declsOf(styles);
        const T = declsOf(tokensCss);
        let compared = 0;
        for (const [name, rawSpec] of S) {
            if (!T.has(name)) continue;
            compared++;
            const a = deref(S, rawSpec).replace(/\s+/g, ' ');
            const b = deref(T, T.get(name)).replace(/\s+/g, ' ');
            if (a !== b) {
                fail('spec-drift', `${name}: the specification says ${a}, the code says ${b}`
                    + ' -- docs/design-system.html vs src/shared/theme/tokens.css');
            }
        }
        if (!compared) {
            fail('spec-drift', 'docs/design-system.html declares no token this check could compare'
                + ' -- the check has stopped reading the specification, which is worse than a drift');
        }
    }
}


/* ---------------------------------------------------------------
   19. Nothing hand-applies a shared control's class name.

   `.btn` was written by hand at 45 call sites across 19 files, `.chip` at 8
   and `.seg` at 3. That is the single mechanism behind most of C1 and C2: a
   class name is not an owner. Nothing knew which cases existed, so the one
   chip that added a close cross was the first to do so and had no way of
   finding that out; the one segment that set `aria-pressed` without the `on`
   class looked unselected for as long as it existed; and `.chip` had two
   selected appearances in two layers that painted a third thing when both
   were present.

   Button.jsx, Chip.jsx and Segment.jsx now own that markup, so the class
   names are theirs. A `className="btn"` written anywhere else is a 46th
   definition of the button that no measurement in this repo can see, and it
   is how the next case gets solved in one file and stays broken in the other
   eighteen.

   The components themselves are exempt -- they are where the class is
   supposed to be written. A control's own name as a MODIFIER (`chips`,
   `pchip`, `fchip`, `filterbtn`) is a different class and is not matched. */
{
    const OWNED = {
        btn: 'shared/ui/Button.jsx  -- <Button variant="quiet|ghost" size="lg" block busy as={Link}>',
        chip: 'shared/ui/Chip.jsx   -- <Chip selected count onRemove> / <RemovableChip>',
        seg: 'shared/ui/Segment.jsx -- <Segment selected tone>',
    };
    const OWNERS = ['shared/ui/Button.jsx', 'shared/ui/Chip.jsx', 'shared/ui/Segment.jsx'];

    for (const f of jsx) {
        const rel = relative(ROOT, f);
        if (OWNERS.some((o) => rel.endsWith(o))) continue;
        const src = readFileSync(f, 'utf8');
        const lines = src.split('\n');
        lines.forEach((line, i) => {
            /* Only a className. A `.btn` inside a comment or a selector string
               is prose, not markup. */
            for (const m of line.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{[^}]*?['"]([^'"]*)['"])/g)) {
                const classes = (m[1] || m[2] || m[3] || '')
                    .replace(/\$\{[^}]*\}/g, ' ').split(/\s+/).filter(Boolean);
                for (const c of classes) {
                    if (OWNED[c]) {
                        fail('owned-class', `${rel}:${i + 1}: className has "${c}" by hand -- use ${OWNED[c]}`);
                    }
                }
            }
        });
    }
    /* A check that cannot see the thing it forbids passes forever. Three
       checks in this repo have already done exactly that (C7.7), so this one
       states what it managed to read. */
    const owners = jsx.filter((f) => OWNERS.some((o) => relative(ROOT, f).endsWith(o)));
    if (owners.length !== OWNERS.length) {
        fail('owned-class', `expected ${OWNERS.length} component files to own these classes, found ${owners.length}`
            + ' -- the component layer has moved and this check is looking at nothing');
    }
}


/* ---------------------------------------------------------------
   20. The toast is mounted once, and raised one way.

   SH15 says there is exactly one toast and the shell owns it, because the
   same action reporting differently depending on where it was done is how one
   piece of furniture owned by two modules comes to mean two things.
   `ToastProvider` was built to settle that -- and then Library and Title went
   on rendering their own, so three <Toast> elements were mounted at once.

   They do not queue. `.toast` is `position: fixed` at one coordinate:
   measured, two of them land in the same 358x48 box at (16, 732) on a 390px
   screen, with the same `--z-toast`. So the later one in the DOM is drawn
   over the earlier, and `elementFromPoint` at the centre returns the later
   one -- the provider's, because it renders after its children. You read one
   message and your tap undid the other action.

   Library also spelled the action `undo:` where everything else said
   `actionLabel` + `onAction`, translated at its own call site. Two spellings
   for one prop, which is the C6.3 defect one level up: a prop contract that
   nothing enforces.

   So: one mount point, and every other screen goes through `useToast`. */
{
    const PROVIDER = 'app/ToastProvider.jsx';
    const mounts = [];
    for (const f of jsx) {
        const rel = relative(ROOT, f);
        const src = readFileSync(f, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        src.split('\n').forEach((line, i) => {
            /* Not `[\s/>]` -- `<Toast` is the whole line where the props are
               indented below it, so there is no following character to match.
               The first draft used that and found nothing; the "counting
               nothing" guard below is what caught it on the first run. */
            if (/<Toast(?![A-Za-z])/.test(line)) mounts.push({ rel, line: i + 1 });
        });
        /* The old spelling, wherever a toast is raised. */
        for (const m of src.matchAll(/\bundo\s*:/g)) {
            const line = src.slice(0, m.index).split('\n').length;
            fail('one-toast', `${rel}:${line}: a toast raised with \`undo:\``
                + ' -- Toast reads `actionLabel` and `onAction`, so this renders a dismiss cross');
        }
    }
    for (const m of mounts) {
        if (!m.rel.endsWith(PROVIDER)) {
            fail('one-toast', `${m.rel}:${m.line}: a second <Toast> is mounted here`
                + ` -- there is one, in ${PROVIDER}; raise this through useToast()`);
        }
    }
    /* A check that cannot find the thing it counts passes forever (C7.7). */
    if (!mounts.some((m) => m.rel.endsWith(PROVIDER))) {
        fail('one-toast', `no <Toast> found in ${PROVIDER}`
            + ' -- the shell has stopped mounting one, and this check is counting nothing');
    }
}


/* ---------------------------------------------------------------
   21. Selection is an ARIA attribute, never a class.

   One state had two spellings and that is how the Kind filter looked
   unselected for as long as it existed: `.seg.on` was the only rule that
   drew a selected segment, and FilterPanel set `aria-pressed` and never
   added the class. It announced itself correctly to a screen reader and
   showed nothing at all to everybody else.

   Every OTHER selectable control wrote both -- the class and the attribute,
   agreeing. That is not a safety net. It is two chances to be wrong, and the
   reason nobody noticed the one place they disagreed: twelve controls where
   the pair matched made the pair look like the convention.

   So the stylesheet selects on the attribute the control's role requires:
   `aria-pressed` for a toggle button, `aria-selected` inside a tablist,
   `aria-current` for the link to the page you are on. A selected look is now
   unreachable without the announcement that goes with it, which is the whole
   point -- the two cannot drift, because there is only one of them.

   `.on` is forbidden outright rather than kept as a synonym because it also
   meant two other things: a lit star in the rating (now `.full`) and the
   library's find row being open (now `.finding`). One class, three meanings,
   and no reader could tell which from the name. */
{
    /* A machine cannot tell what a class MEANS, so this forbids the names
       that have ever meant "selected" in this codebase or in the idiom
       around it. A new one invented tomorrow is not caught, which is why the
       convention is also written down in CONTROLS.md C4. */
    const SYNONYMS = ['on', 'sel', 'selected', 'is-selected', 'active', 'is-active',
        'current', 'is-current', 'checked', 'chosen'];
    const alt = SYNONYMS.join('|');
    /* `(?![\w-])` is what keeps `.on-image` out of it -- a different class
       that happens to start with the same two letters. */
    const inCss = new RegExp(`\\.(${alt})(?![\\w-])`, 'g');

    let selectionRules = 0;
    for (const f of cssFiles) {
        const rel = relative(ROOT, f);
        const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        src.split('\n').forEach((line, i) => {
            /* Declarations only, not a selector's braces content. A `.on` can
               only be in the selector, which is before the first `{`. */
            const selector = line.split('{')[0];
            for (const m of selector.matchAll(inCss)) {
                fail('aria-selection', `${rel}:${i + 1}: \`.${m[1]}\` styles a state as a class`
                    + ' -- selection is aria-pressed, aria-selected or aria-current (C4)');
            }
        });
        selectionRules += [...src.matchAll(/\[aria-(pressed|selected|current)/g)].length;
    }

    for (const f of jsx) {
        const rel = relative(ROOT, f);
        const src = readFileSync(f, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        src.split('\n').forEach((line, i) => {
            for (const m of line.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)) {
                const text = (m[1] || m[2] || '');
                /* Class STRINGS only. `fav.on` is a property read, not a
                   class, and `open === k` is a comparison -- both appear
                   inside a className expression and neither is a class. */
                for (const q of text.matchAll(/['"`]([^'"`]*)['"`]/g)) {
                    for (const c of q[1].split(/\s+/).filter(Boolean)) {
                        if (SYNONYMS.includes(c)) {
                            fail('aria-selection', `${rel}:${i + 1}: className applies \`${c}\``
                                + ' -- write the state as aria-pressed / aria-selected, which is what the stylesheet selects on (C4)');
                        }
                    }
                }
                if (m[1] !== undefined) {
                    for (const c of m[1].split(/\s+/).filter(Boolean)) {
                        if (SYNONYMS.includes(c)) {
                            fail('aria-selection', `${rel}:${i + 1}: className applies \`${c}\``
                                + ' -- write the state as aria-pressed / aria-selected (C4)');
                        }
                    }
                }
            }
        });
    }

    /* C7.7 -- a check that cannot find what it counts passes forever. If no
       stylesheet selects on a selection attribute, the convention has been
       abandoned and the half above is guarding nothing. */
    if (selectionRules < 10) {
        fail('aria-selection', `only ${selectionRules} rules select on an ARIA selection attribute`
            + ' -- the stylesheets have stopped styling selection this way, so this check is guarding nothing');
    }
}


const byCheck = new Map();
for (const f of failures) byCheck.set(f.check, [...(byCheck.get(f.check) || []), f.detail]);


const CHECKS = [
    ['undefined-class', 'Every class in the markup has a CSS rule'],
    ['shapeless-class', 'Every class sets at least one box property'],
    ['raw-colour', 'No hard-coded colour in components'],
    ['hardcoded-gutter', 'One gutter token, obeyed by everything'],
    ['undefined-token', 'Every custom property used is declared'],
    ['inline-style', 'No inline styles outside Skeleton; dynamic values only'],
    ['class-ownership', "A module's own classes are used only by that module"],
    ['deep-import', 'Modules are imported only through their index'],
    ['token-scale', 'Lengths in a converted module come from the scale'],
    ['gutter-bands', 'The gutter and the container step only at their bands'],
    ['control-colour', 'A control with a background declares its colour'],
    ['focus-ring', 'Focus is never removed without a replacement'],
    ['layer-token', 'Five layers, and nothing between them'],
    ['icon-component', 'An icon is a component, never a character'],
    ['component-import', 'A component used is a component imported'],
    ['icon-name', 'An icon names a role the set actually has'],
    ['icon-row', 'An icon beside content sits in a row that was declared'],
    ['spec-drift', 'The specification and the code agree on every token'],
    ['owned-class', 'A shared control\'s class is written by its component, not by hand'],
    ['one-toast', 'One toast, mounted by the shell, raised one way'],
    ['aria-selection', 'Selection is an ARIA attribute, never a class'],
];

let failed = 0;
for (const [key, label] of CHECKS) {
    const hits = byCheck.get(key) || [];
    if (hits.length) {
        failed++;
        console.log(`\n  FAIL  ${label}`);
        for (const h of hits.slice(0, 10)) console.log(`        ${h}`);
        if (hits.length > 10) console.log(`        …and ${hits.length - 10} more`);
    } else {
        console.log(`  ok    ${label}`);
    }
}

console.log('');
if (failed) {
    console.log(`${failed} of ${CHECKS.length} checks failed.\n`);
    process.exit(1);
}
console.log(`All ${CHECKS.length} checks passed.\n`);
