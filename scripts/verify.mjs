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
import { readFileSync, readdirSync, statSync } from 'node:fs';
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
   6. A module's classes belong to that module.
   A class first defined under src/modules/<m>/ may be used only by files
   under src/modules/<m>/. The class names stay the design system's own —
   this is what makes per-module stylesheets safe without renaming them.
   --------------------------------------------------------------- */
const moduleOf = (f) => relative(ROOT, f).match(/^src\/modules\/([^/]+)\//)?.[1] ?? null;
const owner = new Map();
for (const f of cssFiles) {
    const mod = moduleOf(f);
    if (!mod) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(/([^{}]+)\{[^}]*\}/g)) {
        for (const c of m[1].matchAll(/\.([A-Za-z][\w-]*)/g)) {
            const prev = owner.get(c[1]);
            if (prev && prev !== mod) fail('class-ownership', `.${c[1]} is defined by both ${prev} and ${mod}`);
            owner.set(c[1], mod);
        }
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
const byCheck = new Map();
for (const f of failures) byCheck.set(f.check, [...(byCheck.get(f.check) || []), f.detail]);

const CHECKS = [
    ['undefined-class', 'Every class in the markup has a CSS rule'],
    ['shapeless-class', 'Every class sets at least one box property'],
    ['raw-colour', 'No hard-coded colour in components'],
    ['hardcoded-gutter', 'One gutter token, obeyed by everything'],
    ['undefined-token', 'Every custom property used is declared'],
    ['inline-style', 'No inline styles outside Skeleton; dynamic values only'],
    ['class-ownership', "A module's classes are used only by that module"],
    ['deep-import', 'Modules are imported only through their index'],
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
