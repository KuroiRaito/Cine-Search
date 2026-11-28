#!/usr/bin/env node
/**
 * What the design drew, against what the code can build.
 *
 *   npm run divergence              the report
 *   npm run divergence -- --json    the same thing as data
 *
 * Why this exists: "the anatomy is very different in production and in the
 * designs" was true, and nobody could say *where* without opening two windows
 * and scrolling both. Every answer was somebody's impression of the screen
 * they happened to be looking at, and the fix that followed was for that
 * screen only. This reads both sides and says which bands, which classes and
 * which stated numbers disagree.
 *
 * It is a DIFF, not a judge. It reports disagreements; whether a disagreement
 * is a bug, a deliberate decision the doc never caught up with, or a drawing
 * that was never meant literally, is a person's call. That is why nothing here
 * exits non-zero -- see the note at the bottom.
 *
 * ---- what the two sides are ----
 *
 * The design side is the module docs. They are not pictures: each screen is
 * real markup with real class names under `.phone > .screen > .scroll`, which
 * is what makes this mechanical at all. Desktop screens (`.desk > .dbody`) are
 * drawn with inline styles instead, so they yield geometry rather than names.
 *
 * The code side is the stylesheets (which classes have rules) and the JSX
 * (which classes get written). A class the design draws and neither side has
 * is a band that was designed and never built -- or built under another name,
 * which this cannot tell apart and does not pretend to.
 *
 * ---- the three lanes ----
 *
 *   bands     the sequence of top-level bands in a designed screen, so a
 *             missing one, an extra one or a reordered one is visible
 *   classes   every class a designed screen uses, against every class the
 *             product declares or writes
 *   numbers   numbers the design states out loud -- an aspect-ratio in an
 *             inline style, a figure in a `note law` -- against the value the
 *             stylesheets declare for the same property
 *
 * The third lane is the one that found the banner. The design's own D1 note
 * says a 2:1 banner at 1120 wide is 560px tall and calls that half the window
 * spent on decoration; the drawing is 4:1; the product ships 3:1 at every
 * width, which is 400px at desktop. Three numbers, three places, and the only
 * way anyone was going to notice was to read all three at once.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const JSON_OUT = process.argv.includes('--json');

/* The product's own stylesheets, in cascade order. `tokens.css` is in here
   for completeness even though it declares no classes -- leaving it out would
   make the "every stylesheet" claim in the report untrue. */
const SHEETS = [
    'src/shared/theme/tokens.css',
    'src/shared/ui/ui.css',
    'src/app/shell.css',
    ...readdirSync(join(ROOT, 'src/modules'))
        .map((m) => `src/modules/${m}/${m}.css`)
        .filter((p) => { try { readFileSync(join(ROOT, p)); return true; } catch { return false; } }),
];

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };

/* ------------------------------------------------------------------ *
 * the code side: which classes exist at all                           *
 * ------------------------------------------------------------------ */

/* Class names that have a rule somewhere in the product's CSS. The regex is
   deliberately loose -- it takes every `.name` that looks like a selector,
   including ones inside :is() and compound selectors, because a false
   POSITIVE here only costs a missed finding, while a false negative invents
   one. A diff that cries wolf stops being read. */
function declaredClasses() {
    const found = new Map();
    for (const rel of SHEETS) {
        const css = readFileSync(join(ROOT, rel), 'utf8')
            /* Comments first: `.chip` discussed in a comment is not a rule,
               and the stylesheets here carry long ones. */
            .replace(/\/\*[\s\S]*?\*\//g, '');
        /* Only the selector side of a rule. Declaration values hold things
           like `url(.foo)` and shorthand that would otherwise read as
           classes. */
        /* Three groups, and the selector is the SECOND one -- the first is
           the `}` or `@` that proves a rule is starting. Reading group one by
           mistake made every class in the product look undeclared, and the
           report cheerfully said so: 143 bands "drawn but never built", in a
           codebase where nearly all of them exist. A diff that is wrong in
           this direction is worse than no diff, because every entry looks
           like a finding. */
        for (const [, , sel] of css.matchAll(/(^|[}@])([^{}@]*?)\{/g)) {
            for (const [, name] of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
                if (!found.has(name)) found.set(name, rel);
            }
        }
    }
    return found;
}

/* Class names any .jsx writes. Covers the three shapes the codebase uses:
   a literal className, a template literal, and the component layer's own
   props -- Button/Chip/Segment write `.btn`, `.chip`, `.seg` themselves
   (CLAUDE.md 2.1), so those never appear as literals and would otherwise
   read as undeclared. */
function writtenClasses() {
    const found = new Set(['btn', 'chip', 'seg']);
    const walk = (dir) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            const p = join(dir, e.name);
            if (e.isDirectory()) { walk(p); continue; }
            if (!e.name.endsWith('.jsx') && !e.name.endsWith('.js')) continue;
            const src = readFileSync(p, 'utf8');
            for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
                const body = m[1] ?? m[2] ?? m[3] ?? '';
                /* A template literal carries `${...}` holes. Strip them and
                   keep the literal words around them -- those are real. */
                for (const w of body.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
                    if (/^-?[_a-zA-Z][\w-]*$/.test(w)) found.add(w);
                }
            }
            /* Strings handed to a `cls`/`classList`-style join, and the
               component layer's variant words. */
            for (const m of src.matchAll(/['"]([a-z][\w-]*)['"]\s*(?:,|\])/g)) {
                if (/-/.test(m[1])) found.add(m[1]);
            }
        }
    };
    walk(join(ROOT, 'src'));
    return found;
}

/* ------------------------------------------------------------------ *
 * the design side: read the drawings in a real browser                *
 * ------------------------------------------------------------------ */

/* Runs inside the page. Returns one entry per drawn screen.
 *
 * The caption is the screen's identity -- `P1`, `D2`, `L11` -- and it is what
 * the laws and the audit refer to, so a screen without one is reported rather
 * than silently numbered, because a finding nobody can look up is noise. */
const EXTRACT = `(() => {
    const txt = (el) => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : '');
    const idOf = (cap) => {
        const b = cap && cap.querySelector('b');
        return { id: txt(b) || null, label: txt(cap).replace(txt(b), '').replace(/^[\\s·-]+/, '') };
    };

    /* A band is a direct child of the scrolling area. Its name is its first
       class, because that is how the docs name things; an unclassed band is
       reported as its tag so it still appears in the sequence. */
    const bandsOf = (holder) => [...(holder ? holder.children : [])].map((el) => ({
        name: el.classList[0] || ('<' + el.tagName.toLowerCase() + '>'),
        classes: [...el.classList],
        /* Inline geometry is the only thing a desktop drawing says in a
           machine-readable way, so keep the three properties that decide a
           band's shape. */
        inline: (el.getAttribute('style') || '')
            .split(';')
            .map((d) => d.trim())
            .filter((d) => /^(aspect-ratio|grid-template-columns|max-width|width|height|columns)\\s*:/.test(d)),
        /* The RESOLVED ratio, not the declared one. A phone drawing states
           its shape in the document's own stylesheet rather than inline --
           P1's banner is \`.pbanner.tall\`, and reading the inline style alone
           reports nothing for it and silently loses half the specification.
           The computed value is what the drawing actually renders at, which
           is the thing the product is supposed to match, and it does not care
           which of the two places the rule was written in. */
        ratio: getComputedStyle(el).aspectRatio,
        text: txt(el).slice(0, 80),
    }));

    const screens = [];

    /* Phone drawings: real class names. */
    for (const phone of document.querySelectorAll('.phone')) {
        const { id, label } = idOf(phone.querySelector('.phone-cap'));
        screens.push({
            device: 'phone', id, label,
            bands: bandsOf(phone.querySelector('.screen .scroll') || phone.querySelector('.screen')),
        });
    }

    /* Desktop drawings: inline styles. The caption sits OUTSIDE the wrapper,
       immediately before it, so it is found by walking back rather than by
       querying inside. */
    for (const wrap of document.querySelectorAll('.deskwrap')) {
        let cap = wrap.previousElementSibling;
        while (cap && !cap.classList.contains('deskcap')) cap = cap.previousElementSibling;
        const { id, label } = idOf(cap);
        screens.push({
            device: 'desk', id, label,
            bands: bandsOf(wrap.querySelector('.dbody') || wrap.querySelector('.desk')),
        });
    }

    /* Every class any drawing uses, at any depth -- the vocabulary. The page
       chrome is excluded: .wrap, .shead and friends are the DOCUMENT's own
       furniture, not the product's, and counting them would bury the real
       findings under fifty false ones. */
    const vocab = {};
    for (const root of document.querySelectorAll('.phone .screen, .deskwrap .desk')) {
        for (const el of root.querySelectorAll('*')) {
            for (const c of el.classList) (vocab[c] ??= []).push(1);
        }
    }

    /* The laws, with their numbers. A law is the design speaking in its own
       voice about what must be true, so it is quoted verbatim rather than
       summarised -- a paraphrased rule is a different rule. */
    const notes = [...document.querySelectorAll('.note')].map((el) => ({
        kind: [...el.classList].find((c) => c !== 'note') || 'plain',
        text: txt(el),
        numbers: (txt(el).match(/\\b\\d+(?:\\.\\d+)?\\s*(?::\\s*\\d+|px|%|ch|ms|s)?\\b/g) || []),
    }));

    return { screens, vocab: Object.fromEntries(Object.entries(vocab).map(([k, v]) => [k, v.length])), notes };
})()`;

/* ------------------------------------------------------------------ */

const server = createServer((req, res) => {
    const path = decodeURIComponent(req.url.split('?')[0]);
    try {
        const body = readFileSync(join(ROOT, path.replace(/^\//, '')));
        res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
        res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();

const docs = readdirSync(join(ROOT, 'docs')).filter((f) => f.endsWith('-module.html')).sort();
const modules = {};

for (const file of docs) {
    const name = file.replace('-module.html', '');
    await page.goto(`${base}/docs/${file}`, { waitUntil: 'domcontentloaded' });
    modules[name] = await page.evaluate(EXTRACT);
}

await browser.close();
await new Promise((r) => server.close(r));

/* ------------------------------------------------------------------ *
 * the anatomy diff                                                    *
 * ------------------------------------------------------------------ */

/* Which drawing is the product's default state, per screen `npm run snap`
 * photographs. Declared by hand because it cannot be inferred: `P1` is the
 * filled overview and `P3` is the same screen loading, and only a person
 * knows which one a screenshot taken after the data arrives should be read
 * against. Wrong entries here produce wrong findings, so the report prints
 * this table and names it as a judgement call.
 *
 * The screens with no entry are not oversights:
 *   entry/*            the welcome module has no -module.html doc
 *   profile/settings   designed as part of shell, not drawn as a screen
 */
const MATCH = {
    'profile/profile@390':  ['profile', 'P1'],
    'profile/profile@1280': ['profile', 'D1'],
    'library/library@390':  ['library', 'L1'],
    'library/library@1280': ['library', 'D1'],
    'title/film@390':       ['title', 'TM1'],
    'title/series@390':     ['title', 'TV3'],
    'person/director@390':  ['title', 'TP1'],
    'search/results@390':   ['find', 'FQ3'],
    'discover/home@390':    ['find', 'FD3'],
};

/* Design's word for a band, against the product's. Only genuine synonyms --
   the same band under two names -- never two different bands forced together,
   which would hide the divergence this script exists to find. */
const ALIAS = {
    lh: 'page-head', lchips: 'chips', phero: 'hero', tbd: 'hero',
    pname: 'pid', 'pav-row': 'pav-row',
    /* Person, added 2026-11-28 (B4). Each of these three was checked against
       both markups rather than guessed from the name, and each is the same
       band holding the same thing:

         phdr   -> pintro   photo, name and the one-line description, as a
                            flex row. The drawing's `.phdr .pimg/.pbd` and
                            the product's `.pintro > .phead` are the same
                            two columns.
         pstrip -> pstats   the dt/dd strip. Both hold exactly Credits,
                            "You have seen" and Active, in that order.
         pfilt  -> rolesw   the role filter. All / Directed / Wrote in the
                            drawing, All / <role> in the product.

       `phero` is deliberately NOT given a new target. It already aliases to
       `hero`, and the person page does not build one -- it opens on
       `page-head`. That is a finding, and aliasing it to `page-head` to make
       the row go green would delete it. */
    phdr: 'pintro', pstrip: 'pstats', pfilt: 'rolesw',
};

/* The shell's furniture. The design draws it on every module screen because a
   drawing has to show the whole phone; the product renders it once, outside
   `.page`, which is correct and is not a missing band. Subtracted rather than
   reported, with the reason here instead of in a footnote nobody reads. */
const SHELL = new Set(['bnav', 'dtop', 'dnav', 'dwm']);

/* Descend through a wrapper that exists only to lay bands out. The test is
   whether descending yields MORE bands the design also names: `pid` is not a
   word the design uses, but `pbanner` and `pav-row` are, so `pid` is a
   wrapper. `sblock` is a word the design uses and its children are not, so it
   is a band and the walk stops. This is the rule that stops title reading as
   two bands when the design draws six. */
function flatten(bands, vocab) {
    const out = [];
    for (const b of bands) {
        const kids = b.children || [];
        const mineKnown = vocab.has(b.name) ? 1 : 0;
        const kidsKnown = kids.filter((c) => vocab.has(c.name)).length;
        if (kidsKnown > mineKnown) out.push(...kids.map((c) => ({ ...c, via: b.name })));
        else out.push(b);
    }
    return out;
}

/* A plain longest-common-subsequence, so the report can say "this band is
   extra" and "this one is missing" rather than "everything after position 3
   differs" -- which is what a positional compare says the moment one band is
   inserted, and it is useless. */
function diffSeq(a, b) {
    const n = a.length, m = b.length;
    const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
        }
    }
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) { ops.push(['=', a[i]]); i++; j++; }
        else if (L[i + 1][j] >= L[i][j + 1]) { ops.push(['-', a[i]]); i++; }
        else { ops.push(['+', b[j]]); j++; }
    }
    while (i < n) ops.push(['-', a[i++]]);
    while (j < m) ops.push(['+', b[j++]]);
    return ops;
}

function anatomyDiff(modules, anatomy) {
    const rows = [];
    for (const [stem, [mod, id]] of Object.entries(MATCH)) {
        const drawn = modules[mod]?.screens.find((s) => s.id === id);
        /* Dark and light render the same boxes, so one theme is enough; the
           report says so rather than implying both were read. */
        const built = anatomy[`${stem}-dark`];
        if (!drawn || !built) { rows.push({ stem, mod, id, missing: !drawn ? 'drawing' : 'render' }); continue; }

        const vocab = new Set(drawn.bands.map((b) => b.name));
        const design = drawn.bands.map((b) => b.name).filter((n) => !SHELL.has(n));
        const prod = flatten(built, vocab)
            .map((b) => ALIAS[b.name] || b.name)
            .filter((n) => !SHELL.has(n));
        const designA = design.map((n) => ALIAS[n] || n);

        /* Two reasons a comparison is not worth printing, both measured
           rather than assumed, because a diff nobody can trust is worse than
           no diff -- every row looks like a finding and the two real ones get
           read with the same shrug as the seven false ones.

           ONE: the drawing has no names to compare. The desktop screens are
           built from inline styles on bare <div>s, so their band list is
           `<div> <div> <div>` and any diff against it is an artefact of that,
           not a statement about the product.

           TWO: the two sides do not share a vocabulary. Where the code was
           written without reference to the doc's names -- find, title and
           person all were -- the sequences can be identical in meaning and
           disjoint in spelling, and a name diff reports a rewrite. Overlap is
           the honest test, and it is a measurement: how much of what the
           design named appears anywhere in what the code built. */
        const unnamed = design.filter((n) => n.startsWith('<')).length;
        const inProd = new Set(prod);
        const shared = designA.filter((n) => inProd.has(n)).length;
        const overlap = designA.length ? shared / designA.length : 0;

        const ops = diffSeq(designA, prod);
        rows.push({
            stem, mod, id, label: drawn.label,
            design: designA, prod, ops, overlap,
            comparable: unnamed <= design.length / 2 && overlap >= 0.5,
            why: unnamed > design.length / 2 ? 'drawn with inline styles, no band names'
                : overlap < 0.5 ? `vocabularies share ${Math.round(overlap * 100)}% of band names`
                : null,
            extra: ops.filter((o) => o[0] === '+').length,
            missing: ops.filter((o) => o[0] === '-').length,
        });
    }
    return rows;
}

/* ------------------------------------------------------------------ *
 * stated numbers                                                      *
 * ------------------------------------------------------------------ */

/* The lane that found the banner, generalised.
 *
 * A ratio is the one piece of geometry a drawing states exactly and a
 * stylesheet declares exactly, so the two can be read against each other with
 * no interpretation in between. Everything else in a drawing is a length in a
 * mock, which means nothing on its own.
 *
 * The design states ratios in two places and they are allowed to differ from
 * each other on purpose -- a band is often drawn one shape on a phone and
 * another on a desktop, and the note says which. So this collects BOTH and
 * prints them together with whatever the CSS declares, rather than picking a
 * winner. Three numbers in three places was exactly the shape of the banner
 * bug, and no two of them read together would have found it.
 */
function ratios(modules) {
    const out = [];
    for (const [mod, data] of Object.entries(modules)) {
        const drawn = new Set();
        for (const s of data.screens) {
            for (const b of s.bands) {
                for (const d of b.inline) {
                    const m = /aspect-ratio\s*:\s*([\d.]+)\s*\/\s*([\d.]+)/.exec(d);
                    if (m) drawn.add(`${b.name}|${m[1]}:${m[2]}|${s.device}`);
                }
                /* `auto` is every band that does not state a shape, which is
                   nearly all of them; only a stated one is evidence. */
                const c = /^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/.exec(b.ratio || '');
                if (c) drawn.add(`${b.name}|${c[1]}:${c[2]}|${s.device}`);
            }
        }
        /* A ratio a note argues about, with the sentence it argues in. These
           are the design explaining itself, and the explanation is usually
           where the real constraint is written down. */
        /* ONE row per note, not one per number in it. The banner note argues
           4:1 against 2:1 and mentions 2:1 twice, so an occurrence-per-row
           printed the same sentence three times and made a single argument
           look like three findings.

           The excerpt is centred on the first ratio rather than taken from
           the start, because a note that mentions 16:9 in its last clause
           printed 150 characters in which the matched number does not appear
           -- a row whose own evidence is off-screen. */
        const said = [];
        for (const n of data.notes) {
            const hits = [...n.text.matchAll(/\b(\d+)\s*:\s*(\d+)\b/g)];
            if (!hits.length) continue;
            const at = Math.max(0, hits[0].index - 40);
            said.push({
                ratios: [...new Set(hits.map((m) => `${m[1]}:${m[2]}`))],
                kind: n.kind,
                text: (at ? '...' : '') + n.text.slice(at, at + 150),
            });
        }
        /* Grouped, because a band drawn the same way on eleven screens is one
           fact stated eleven times, and printing it eleven times buries the
           one place the number changes. The COUNT is the interesting part --
           it says how settled the design is about that shape. */
        const tally = new Map();
        for (const s of data.screens) {
            for (const b of s.bands) {
                const seen = new Set();
                const add = (r) => { const k = `${b.name}|${r}|${s.device}`; if (!seen.has(k)) { seen.add(k); tally.set(k, (tally.get(k) || 0) + 1); } };
                for (const d of b.inline) {
                    const m = /aspect-ratio\s*:\s*([\d.]+)\s*\/\s*([\d.]+)/.exec(d);
                    if (m) add(`${m[1]}:${m[2]}`);
                }
                const c = /^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/.exec(b.ratio || '');
                if (c) add(`${c[1]}:${c[2]}`);
            }
        }
        const grouped = [...tally].map(([k, n]) => {
            const [name, ratio, device] = k.split('|');
            return { name, ratio, device, screens: n };
        }).sort((a, b) => b.screens - a.screens);
        if (grouped.length || said.length) out.push({ mod, drawn: grouped, said });
    }
    return out;
}

/* Every aspect-ratio the product actually declares, with the selector and the
 * width it applies at -- the third number.
 *
 * MEDIA-AWARE, and it has to be. The first version read rules with one flat
 * regex, which could not see inside an `@media` block and reported only the
 * base declaration. So a band given its designed shape at a breakpoint still
 * read as a divergence, for ever, and the next person to open the report
 * would have redone work that was already done. A diff that cannot see the
 * fix is worse than one that cannot see the bug.
 *
 * A real brace scanner rather than a cleverer regex: CSS nests, and the
 * flat-regex version also silently dropped the FIRST rule inside every block,
 * because its "a rule starts after } or @" test is false for a rule that
 * starts after {.
 */
function builtRatios() {
    const out = [];
    for (const rel of SHEETS) {
        const css = readFileSync(join(ROOT, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        /* at[] is the stack of @-conditions we are inside; buf collects the
           selector (or at-rule prelude) being read up to its own `{`. */
        const at = [];
        let buf = '';
        for (let i = 0; i < css.length; i++) {
            const c = css[i];
            if (c === '{') {
                const head = buf.replace(/\s+/g, ' ').trim();
                buf = '';
                if (head.startsWith('@')) { at.push(head); continue; }
                /* A plain rule: read to its closing brace. */
                const end = css.indexOf('}', i);
                const body = css.slice(i + 1, end === -1 ? css.length : end);
                const r = /aspect-ratio\s*:\s*([\d.]+)\s*\/\s*([\d.]+)/.exec(body);
                if (r) {
                    out.push({
                        sel: head,
                        ratio: `${r[1]}:${r[2]}`,
                        at: at.filter((a) => a.startsWith('@media')).join(' '),
                        file: rel,
                    });
                }
                i = end === -1 ? css.length : end;
            } else if (c === '}') {
                at.pop();
                buf = '';
            } else buf += c;
        }
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * the cross-reference                                                 *
 * ------------------------------------------------------------------ */

const declared = declaredClasses();
const written = writtenClasses();

/* The product's side. Written by `npm run snap`, which renders the real app
   against frozen fixtures -- so this is what the code PRODUCES, not what it
   appears to say. A stale or absent file is reported rather than worked
   around: a diff against yesterday's render is a diff nobody can act on. */
let anatomy = null;
try { anatomy = JSON.parse(readFileSync(join(ROOT, 'snapshots/anatomy.json'), 'utf8')); } catch {}
const anat = anatomy ? anatomyDiff(modules, anatomy) : [];

/* Classes the DOCUMENTS use for their own furniture rather than for the
   product. Excluded by name because they are a closed set and listing them is
   honest, where a heuristic ("anything not in the product") would quietly
   decide the answer this script exists to report. */
const CHROME = new Set([
    'phone', 'phone-cap', 'screen', 'scroll', 'desk', 'deskwrap', 'deskscale',
    'deskcap', 'dtop', 'dnav', 'dwm', 'dbody', 'note', 'law', 'ok', 'warn',
    'wrap', 'shead', 'snum', 'phones', 'tag', 'face', 'cap',
]);

const report = { modules: {}, totals: { phone: 0, desk: 0, laws: 0, unbuilt: 0 } };

for (const [name, data] of Object.entries(modules)) {
    const phone = data.screens.filter((s) => s.device === 'phone');
    const desk = data.screens.filter((s) => s.device === 'desk');
    const laws = data.notes.filter((n) => n.kind === 'law');

    /* A designed class with no rule in any stylesheet and no .jsx writing it.
       This is the "drawn but never built" list -- with the caveat, stated in
       the report rather than hidden here, that a band built under a different
       name looks identical to one never built. */
    const unbuilt = Object.keys(data.vocab)
        .filter((c) => !CHROME.has(c) && !declared.has(c) && !written.has(c))
        .sort((a, b) => data.vocab[b] - data.vocab[a]);

    report.modules[name] = {
        phone: phone.length, desk: desk.length, laws: laws.length,
        screens: data.screens, unbuilt, vocab: data.vocab,
        notes: data.notes,
    };
    report.totals.phone += phone.length;
    report.totals.desk += desk.length;
    report.totals.laws += laws.length;
    report.totals.unbuilt += unbuilt.length;
}

report.anatomy = anat;
report.ratios = { design: ratios(modules), built: builtRatios() };
report.codeSide = { declared: declared.size, written: written.size, sheets: SHEETS };

if (JSON_OUT) {
    writeFileSync(join(ROOT, 'snapshots/divergence.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('  wrote snapshots/divergence.json');
} else {
    const pad = (s, n) => String(s).padEnd(n);
    const t = report.totals;

    console.log('\n  WHAT THE DESIGN DREW\n');
    console.log(`  ${pad('module', 12)}${pad('phone', 8)}${pad('desktop', 10)}${pad('total', 8)}laws`);
    console.log('  ' + '-'.repeat(50));
    for (const [name, m] of Object.entries(report.modules)) {
        console.log(`  ${pad(name, 12)}${pad(m.phone, 8)}${pad(m.desk, 10)}${pad(m.phone + m.desk, 8)}${m.laws}`);
    }
    console.log('  ' + '-'.repeat(50));
    console.log(`  ${pad('', 12)}${pad(t.phone, 8)}${pad(t.desk, 10)}${pad(t.phone + t.desk, 8)}${t.laws}`);

    if (!anatomy) {
        console.log('\n  No snapshots/anatomy.json -- run `npm run snap` first for the anatomy diff.\n');
    } else {
        console.log('\n\n  ANATOMY: WHAT THE CODE BUILDS, AGAINST IT\n');
        console.log('  - missing (drawn, not built)   + extra (built, not drawn)   dark theme, one width each\n');
        const cmp = anat.filter((r) => r.comparable);
        const skip = anat.filter((r) => !r.comparable);
        for (const r of cmp) {
            const verdict = !r.extra && !r.missing ? 'matches band for band'
                : [r.missing ? `${r.missing} missing` : '', r.extra ? `${r.extra} extra` : ''].filter(Boolean).join(', ');
            console.log(`  ${pad(r.stem, 24)}${pad(r.id, 6)}${pad(r.label.slice(0, 26), 28)}${verdict}`);
            console.log('      ' + r.ops.map(([op, n]) => (op === '=' ? n : op + n)).join(' '));
        }
        const clean = cmp.filter((r) => r.extra === 0 && r.missing === 0).length;
        console.log(`\n  ${clean} of ${cmp.length} comparable screens match band for band.`);

        /* The ratio lane. Printed per module so a drawing, a note and a
           declaration about the same band land next to each other. */
        const rs = report.ratios;
        console.log('\n\n  STATED SHAPES\n');
        console.log('  What a drawing shows, what a note argues, what the CSS declares.\n');
        for (const r of rs.design) {
            if (!r.drawn.length && !r.said.length) continue;
            console.log(`  ${r.mod}`);
            for (const g of r.drawn) {
                const decl = rs.built.filter((b) => new RegExp('\\.' + g.name + '(?![\\w-])').test(b.sel));
                /* "Agrees" means the product declares this shape SOMEWHERE --
                   at the base or behind a breakpoint. Which width is the
                   design's business and not something the drawing's own
                   markup can say, so the report prints where rather than
                   judging it. */
                const hit = decl.find((b) => b.ratio === g.ratio);
                const where = (b) => (b.at ? b.at.replace('@media ', '').replace(/[()]/g, '') : 'base');
                const mark = !decl.length ? 'no aspect-ratio in CSS'
                    : hit ? `CSS agrees (${where(hit)})`
                    : `CSS says ${[...new Set(decl.map((b) => `${b.ratio} ${where(b)}`))].join(', ')}`;
                console.log(`     drawn  ${pad(g.name, 12)}${pad(g.ratio, 7)}${pad(g.device, 7)}`
                    + `${pad(g.screens + ' screen' + (g.screens > 1 ? 's' : ''), 12)}${mark}`);
            }
            for (const sd of r.said) {
                console.log(`     ${pad(sd.kind, 6)}${pad(sd.ratios.join(' vs '), 12)}"${sd.text.slice(0, 92)}..."`);
            }
        }
        console.log('\n  declared in CSS:');
        for (const b of rs.built) {
            console.log(`     ${pad(b.ratio, 7)}${pad(b.sel.slice(0, 26), 28)}`
                + `${pad(b.at ? b.at.replace('@media ', '').replace(/[()]/g, '') : 'base', 22)}${b.file}`);
        }

        if (skip.length) {
            console.log('\n\n  NOT COMPARABLE BY NAME\n');
            console.log('  Not a clean bill of health -- the diff cannot speak, and says so.\n');
            for (const r of skip) {
                const reason = r.missing === 'drawing' || r.missing === 'render'
                    ? `no ${r.missing}` : r.why;
                console.log(`  ${pad(r.stem, 24)}${pad(r.id || '--', 6)}${reason}`);
            }
        }
    }
    console.log('');
}

/* No exit code, on purpose. Every other script in this repo is a gate -- it
   knows what must be true and fails when it is not. This one does not: a
   disagreement between a drawing and the code is a question for grooming, and
   a script that answered it by failing the build would be deciding, every
   time, that the drawing is right. Several of these disagreements are the
   code being right and the doc being stale. */
