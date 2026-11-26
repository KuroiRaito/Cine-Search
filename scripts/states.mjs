#!/usr/bin/env node
/**
 * State coverage: which states each control actually styles, and which it
 * forgot.
 *
 * `verify.mjs` checks that a rule exists and is well formed. It cannot tell
 * you that a rule exists for the one state anybody ever looks at and for none
 * of the others — and that is where this product breaks. `.chip` styled hover
 * and pressed but had never been drawn holding an icon. `.sw` styles pressed
 * and nothing else. One class in the whole shared layer declares
 * `:focus-visible`; the rest lean on a global rule that was written for
 * controls and also paints a ring around a heading.
 *
 * So this walks the markup to learn what each class really is -- what it is
 * rendered on, whether it is ever disabled, whether it is ever a toggle --
 * and then asks the stylesheets whether the states that kind of control must
 * have are there. It prints a table rather than failing: the gaps are design
 * decisions, and which ones matter is not a machine's call. The parts that
 * are unambiguous belong in verify.mjs as checks.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

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
const jsxFiles = files.filter((f) => ['.jsx', '.js'].includes(extname(f)));
const cssFiles = files.filter((f) => extname(f) === '.css');

/* ---------- which layer a file belongs to ---------- */
const layerOf = (rel) =>
    rel.includes('shared/theme') ? 'tokens'
        : rel.includes('shared/ui') ? 'shared'
            : rel.includes('modules/') ? `module:${rel.split('modules/')[1].split('/')[0]}`
                : rel.includes('app/') ? 'app' : '?';

/* ---------- 1. what each class styles, and where ---------- */
/* `states` is what the BARE class answers for. `variantOnly` is what only a
   variant answers for: `.circ.sm:disabled` in profile.css styles the small
   back button and nothing else, so a plain disabled `.circ` still looks
   clickable. Crediting the base class for it reported a state the product
   does not have -- which the gallery audit caught by rendering it. */
const styled = new Map();   // class -> { states:Set, variantOnly:Set, layers:Set, file }
const conventions = new Map();
const conventionOf = (c) => { if (!conventions.has(c)) conventions.set(c, new Set()); return conventions.get(c); };
/* Paint is what a control LOOKS like; the rest is how much room it gets.
   The distinction is the whole of C5.4: a module may position a shared
   control and may not repaint it, and a count that lumps the two together
   can never reach zero, so it cannot be a gate and stops being read.
   `padding` and `width` are deliberately NOT here -- a card deciding its
   action is full width is a layout decision, and `--sheet-pad` is a knob the
   control itself declares for exactly that purpose (C5.5). */
const PAINT_PROPS = /(^|[;\s])(background|background-[a-z-]+|color|border|border-[a-z-]*colou?r|border-[a-z-]*width|border-[a-z-]*style|border-radius|box-shadow|font-weight|font-family|font-size|font-style|opacity|filter|backdrop-filter|text-decoration[a-z-]*|text-transform|letter-spacing|outline[a-z-]*)\s*:/;
const paints = (decls) => PAINT_PROPS.test(decls || '');

const note = (cls, state, rel, variantOnly, decls) => {
    if (!styled.has(cls)) styled.set(cls, { states: new Set(), variantOnly: new Set(), layers: new Set(), paintLayers: new Set(), posLayers: new Set(), file: rel });
    const e = styled.get(cls);
    if (state) (variantOnly ? e.variantOnly : e.states).add(state);
    e.layers.add(layerOf(rel));
    if (decls !== undefined) (paints(decls) ? e.paintLayers : e.posLayers).add(layerOf(rel));
};

for (const f of cssFiles) {
    const rel = relative(ROOT, f);
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        for (const sel of m[1].split(',')) {
            const s = sel.trim();
            if (!s.includes('.')) continue;
            /* The subject of a selector is its last compound: in
               `.eprow .ed .sc:hover`, the thing being styled is `.sc`. */
            /* A control often answers a state by styling something inside
               itself: `.tile:hover .art` brightens the poster, `.tplay:hover
               img` brightens the still. The subject of that selector is the
               child, so reading only the subject reported the control as
               having no hover at all -- and the honest reading is that it
               has one, on its own hover, drawn on its subtree.

               So credit the compound that CARRIES the pseudo, wherever it
               sits in the selector, as well as the subject. */
            const compounds = s.split(/[\s>+~]+/).filter(Boolean);
            for (const c of compounds.slice(0, -1)) {
                const owner = /\.([A-Za-z0-9_-]+)/.exec(c);
                if (!owner) continue;
                for (const [, ps] of c.matchAll(/:{1,2}([a-z-]+)/g)) {
                    if (['hover', 'focus-visible', 'disabled', 'active'].includes(ps)) {
                        note(owner[1], ps === 'focus-visible' ? 'focus-visible' : ps, rel);
                    }
                }
            }

            /* `:not(:disabled)` is a guard on a state, not a second state.
               `.lbtn:hover:not(:disabled)` is the bare control's hover and
               was being reported as a variant's, because counting pseudo-
               classes counted the ones inside :not() too. */
            const last = (s.split(/[\s>+~]+/).filter(Boolean).pop() || '')
                .replace(/:not\([^()]*\)/g, '');
            const cls = /\.([A-Za-z0-9_-]+)/.exec(last);
            if (!cls) continue;
            const pseudos = [...last.matchAll(/:{1,2}([a-z-]+)/g)].map((p) => p[1]);
            const attrs = [...last.matchAll(/\[([a-z-]+)(?:[~^$*|]?=)?/g)].map((p) => p[1]);
            let state = null;
            if (pseudos.includes('hover')) state = 'hover';
            else if (pseudos.includes('focus-visible')) state = 'focus-visible';
            else if (pseudos.includes('focus-within')) state = 'focus-within';
            else if (pseudos.includes('focus')) state = 'focus';
            else if (pseudos.includes('disabled')) state = 'disabled';
            else if (pseudos.includes('active')) state = 'active';
            if (attrs.includes('aria-pressed') || attrs.includes('aria-selected')
                || attrs.includes('aria-current') || attrs.includes('aria-disabled')
                || attrs.includes('aria-invalid')) {
                note(cls[1], attrs.includes('aria-invalid') ? 'invalid' : 'selected', rel, false, m[2]);
                if (!attrs.includes('aria-invalid')) conventionOf(cls[1]).add('aria');
            }
            /* Selection is also written as a second class -- `.chip.on`,
               `.seg.on`. Three conventions for one state is itself a finding,
               so record which one each control uses rather than only whether
               the state is drawn at all. */
            const compound = [...last.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((c) => c[1]).slice(1);
            const SELECTED = ['on', 'active', 'selected', 'current'];
            if (compound.some((c) => SELECTED.includes(c))) {
                note(cls[1], 'selected', rel, false, m[2]);
                conventionOf(cls[1]).add('class');
            }
            /* A state only belongs to the bare control if nothing else has to
               be true for the rule to apply. Two things disqualify it:

                 a second class  -- `.btn.quiet:hover` is the quiet variant's
                                    hover, and `.circ.sm:disabled` is the small
                                    one's, so a plain disabled `.circ` still
                                    looks clickable;
                 a second pseudo -- `.searchbox:-webkit-autofill:hover` is a
                                    hover the browser only ever shows over an
                                    autofilled field, which is not a hover
                                    state in any sense a designer means it.

               Both were counted as the real thing until the gallery audit
               rendered them and found the cell identical to rest. */
            const conditional = compound.some((c) => !SELECTED.includes(c)) || pseudos.length > 1;
            note(cls[1], state, rel, conditional, m[2]);
        }
    }
}

/* ---------- 2. what each class actually IS, from the markup ---------- */
const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'textarea', 'select', 'Link', 'NavLink']);
const kind = new Map();     // class -> { tags:Set, disabled, toggle, input }
const soloed = new Set();
const seeClass = (cls) => {
    if (!kind.has(cls)) kind.set(cls, { tags: new Set(), disabled: false, toggle: false, input: false, onClick: false });
    return kind.get(cls);
};

for (const f of jsxFiles) {
    const src = readFileSync(f, 'utf8');
    /* Scan element by element so an attribute is attributed to its own tag.
       Brace depth, because `onClick={() => onChange({ ...facets })}` nests. */
    let i = 0;
    while (i < src.length) {
        const lt = src.indexOf('<', i);
        if (lt < 0) break;
        const open = /^<([A-Za-z][\w.]*)/.exec(src.slice(lt, lt + 48));
        if (!open) { i = lt + 1; continue; }
        let j = lt + open[0].length, depth = 0, quote = null;
        for (; j < src.length; j++) {
            const ch = src[j];
            if (quote) { if (ch === quote) quote = null; continue; }
            if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            else if (ch === '>' && depth === 0) break;
        }
        const tag = open[1];
        let k_toggleHint = false;
        const attrs = src.slice(lt + open[0].length, j);
        i = j + 1;

        const cm = /className=(?:"([^"]*)"|\{([\s\S]*)$)/.exec(attrs);
        /* A component supplies its own base class, so the markup no longer
           says it. `<Button className="filterbtn">` renders
           `class="btn filterbtn"`, and a reader that sees only `filterbtn`
           concludes the control has no hover -- which is exactly what this
           tool reported the day the component layer landed, for two controls
           that inherit `.btn:hover` and always did.

           A tool that under-reports is worse than no tool, because the clean
           rows get believed. So the base class is restored here, and the
           PROPS that stand for a class are read as that class: `variant`,
           `size`, `block` and `busy` are `.quiet`, `.btn-lg`, `.block` and
           `.is-waiting`, and `selected` is the `.on`/`aria-pressed` the
           component writes. If a component's API changes, this map is the
           thing to change with it. */
        const OWNS = { Button: 'btn', Chip: 'chip', Segment: 'seg' };
        const PROP_CLASS = {
            'variant="quiet"': 'quiet', 'variant="ghost"': 'ghost',
            'size="lg"': 'btn-lg', block: 'block', busy: 'is-waiting',
            applied: 'applied',
        };
        let names = [];
        if (cm) {
            if (cm[1] !== undefined) names = cm[1].split(/\s+/).filter(Boolean);
            else names = [...attrs.matchAll(/['"`]([^'"`{}$]*)['"`]/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
        }
        if (OWNS[tag]) {
            names.unshift(OWNS[tag]);
            for (const [prop, cls] of Object.entries(PROP_CLASS)) {
                const re = prop.includes('=') ? prop : `\\b${prop}(?=[\\s/>{=]|$)`;
                if (new RegExp(re.replace(/[.*+?^${}()|[\]\\]/g, (c) => (prop.includes('=') ? `\\${c}` : c))).test(attrs)) {
                    names.push(cls);
                }
            }
            /* `selected` is the component's one spelling for a toggle. */
            if (/\bselected[=}\s/>]/.test(attrs)) k_toggleHint = true;
        } else if (!cm) continue;

        for (const n of names) {
            if (!/^[a-z][\w-]*$/.test(n)) continue;
            /* `on` is never a control; it only ever rides one. A class that is
               never written on its own is a modifier and has no state set of
               its own to answer for. */
            if (names.length === 1) soloed.add(n);
            const k = seeClass(n);
            if (INTERACTIVE_TAGS.has(tag) || OWNS[tag]) k.tags.add(tag);
            if (tag === 'input' || tag === 'textarea' || tag === 'select') k.input = true;
            if (/\bdisabled[=}\s]/.test(attrs) || /aria-disabled/.test(attrs)) k.disabled = true;
            if (k_toggleHint || /aria-pressed|aria-selected|aria-current|role="tab"/.test(attrs)) k.toggle = true;
            if (/\bonClick=/.test(attrs)) { k.onClick = true; k.tags.add(tag); }
        }
    }
}

/* ---------- 3. the table ---------- */
/* The global ring used to be a bare `:focus-visible {}`, and asking whether
   it existed was enough. It is now scoped to things that are actually
   controls -- that is what stopped it painting a box around the page
   heading -- so "does it exist" is the wrong question and answering it
   reported MISSING for forty controls it covers perfectly well.

   The right question is per control: is this class rendered on anything the
   rule matches? A class that is only ever put on a <div> with an onClick is
   not covered, cannot be tabbed to, and has no focus state at all -- which
   is worth seeing in this column rather than hiding behind a global yes. */
const ringSel = (() => {
    for (const f of cssFiles) {
        const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        const m = css.match(/([^{}]*:focus-visible)\s*\{/);
        if (m && !/^\s*\./.test(m[1])) return m[1];
    }
    return null;
})();

/* What the markup calls a thing is not what the browser sees: react-router's
   Link and NavLink both render <a href>. */
/* What a tag actually renders, for the focus question. The three
   components default to <button> and take `as` for the rest, so the
   global ring covers them -- without this they read as unfocusable. */
const AS = { Link: 'a', NavLink: 'a', Group: 'div', Button: 'button', Chip: 'button', Segment: 'button' };
const ringTags = new Set();
let ringAttrs = [];
if (ringSel) {
    for (const part of ringSel.split(',')) {
        /* The rule is wrapped in :is(...), so the first part arrives as
           ":is(a[href]" and the last as "[tabindex=\"0\"]):focus-visible". */
        const t = part.trim()
            .replace(/:focus-visible$/, '')
            .replace(/^:(?:is|where)\(/, '')
            .replace(/\)$/, '')
            .trim();
        const tag = t.match(/^([a-z]+)/);
        if (tag) ringTags.add(tag[1]);
        const attr = t.match(/^\[([a-z-]+)=["']?([^\]"']+)/);
        if (attr) ringAttrs.push(`${attr[1]}=${attr[2]}`);
    }
}
const coveredByRing = (k) => [...k.tags].some((t) => ringTags.has(AS[t] || t.toLowerCase()));

const rows = [];
for (const [cls, k] of kind) {
    const interactive = k.tags.size > 0 || k.onClick;
    if (!interactive || !soloed.has(cls)) continue;
    const st = styled.get(cls);
    if (!st) continue;                               // no rule of its own; verify check 1 owns that
    const has = (s) => st.states.has(s);
    const focusOwn = has('focus-visible') || has('focus-within');
    rows.push({
        cls,
        /* Where a control is defined, and where it is then reached into. A
           shared control restyled from a module is how `search.css` came to
           hold a `vertical-align` patch for a chip it does not own -- the fix
           lived one layer away from the rule that caused the problem, so
           neither reader ever saw both. */
        layer: (() => {
            const ls = [...st.layers];
            const home = ls.includes('shared') ? 'shared' : ls.includes('app') ? 'app' : ls[0];
            const reach = ls.filter((l) => l !== home);
            return reach.length ? `${home} +${reach.length} module` : home;
        })(),
        crossesLayers: [...st.layers].length > 1,
        /* Which KIND of reach. `repaint` is the C5.4 violation and should be
           zero; `positioned` is a parent deciding how much room its child
           gets, which is allowed and is most of what is left. */
        repaintedAway: (() => {
            const ls = [...st.layers];
            const home = ls.includes('shared') ? 'shared' : ls.includes('app') ? 'app' : ls[0];
            return [...st.paintLayers].some((l) => l !== home);
        })(),
        positionedAway: (() => {
            const ls = [...st.layers];
            const home = ls.includes('shared') ? 'shared' : ls.includes('app') ? 'app' : ls[0];
            return [...st.posLayers].some((l) => l !== home) && ![...st.paintLayers].some((l) => l !== home);
        })(),
        on: ([...k.tags].join('/') || 'onClick').slice(0, 15),
        hover: has('hover') ? 'yes' : st.variantOnly.has('hover') ? 'variant only' : 'MISSING',
        focus: focusOwn ? 'own'
            : has('focus') ? 'BARE :focus'
                : !ringSel ? 'NO RING AT ALL'
                    : coveredByRing(k) ? 'global' : 'NOT FOCUSABLE',
        disabled: !k.disabled ? '-'
            : has('disabled') ? 'yes'
                : st.variantOnly.has('disabled') ? 'variant only' : 'MISSING',
        selected: !(k.toggle || st.states.has('selected')) ? '-'
            : has('selected') ? [...(conventions.get(cls) || ['?'])].join('+') : 'MISSING',
    });
}
rows.sort((a, b) => a.layer.localeCompare(b.layer) || a.cls.localeCompare(b.cls));

const W = [18, 18, 16, 14, 13, 14, 11];
const head = ['control', 'layer', 'rendered on', 'hover', 'focus', 'disabled', 'selected'];
const line = (c) => c.map((v, n) => String(v).padEnd(W[n])).join('');
console.log('\nSTATE COVERAGE — every class the markup puts on something you can interact with\n');
console.log(line(head));
console.log('-'.repeat(W.reduce((a, b) => a + b, 0)));
for (const r of rows) console.log(line([r.cls, r.layer, r.on, r.hover, r.focus, r.disabled, r.selected]));

const miss = (key) => rows.filter((r) => r[key].startsWith('MISSING')).length;
const variantOnly = rows.filter((r) => r.hover === 'variant only' || r.disabled === 'variant only').length;
console.log(`\n  ${rows.length} controls`);
{
    const repaint = rows.filter((r) => r.repaintedAway);
    const placed = rows.filter((r) => r.positionedAway);
    /* Two numbers, because they are two different things and the old single
       count could never reach zero -- it included every parent that sets a
       margin on a child, which is allowed. A number that cannot reach zero
       is not a gate, and an ungated number stops being read. */
    console.log(`  ${repaint.length} are REPAINTED from another layer${repaint.length ? ` -- ${repaint.map((r) => '.' + r.cls).join(' ')} (C5.4, and verify check 22)` : ' (C5.4)'}`);
    console.log(`  ${placed.length} are positioned from another layer, which is allowed${placed.length ? `: ${placed.map((r) => '.' + r.cls).join(' ')}` : ''}`);
}
console.log(`  ${miss('hover')} style no hover`);
console.log(`  ${variantOnly} answer a state on a variant only, so the bare control does not have it`);
console.log(`  ${rows.filter((r) => r.focus === 'BARE :focus').length} use bare :focus (fires on a mouse click, and stays)`);
console.log(`  ${rows.filter((r) => r.focus === 'global').length} lean on the one global ring`);
{
    const unreachable = rows.filter((r) => r.focus === 'NOT FOCUSABLE');
    if (unreachable.length) {
        console.log(`  ${unreachable.length} cannot be focused at all -- not a missing style, a missing control:`);
        for (const r of unreachable) console.log(`      .${r.cls}  (rendered on ${r.on})`);
    }
}
console.log(`  ${miss('disabled')} can be disabled but do not say so`);
console.log(`  ${miss('selected')} can be selected but do not say so`);
const byConv = (c) => rows.filter((r) => r.selected === c).length;
{
    /* This line used to end "one state, more than one convention" and said it
       whatever the numbers were -- including after there was only one left.
       A summary that states its conclusion before counting is the same fault
       as a check that passes before reading its results (C7.7), just
       quieter. `verify` check 21 is the gate; this says where things stand. */
    const parts = [['aria', byConv('aria')], ['class', byConv('class')], ['both', byConv('aria+class')]]
        .filter(([, n]) => n);
    const written = parts.map(([k, n]) => `${n} as ${k}`).join(', ');
    const verdict = parts.length === 1 && parts[0][0] === 'aria'
        ? 'one state, one convention — the attribute the role requires'
        : 'one state, MORE THAN ONE CONVENTION — this is C4, and it is how the Kind filter looked unselected for months';
    console.log(`  selection is written ${written} — ${verdict}\n`);
}
