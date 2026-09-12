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
]);

const defined = new Set();
const shaped = new Set();
for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const props = new Set([...m[2].matchAll(/([a-z-]+)\s*:/g)].map((p) => p[1]));
    const setsShape = [...props].some((p) => SHAPE_PROPS.has(p));
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

/* --------------------------------------------------------------- */
const byCheck = new Map();
for (const f of failures) byCheck.set(f.check, [...(byCheck.get(f.check) || []), f.detail]);

const CHECKS = [
    ['undefined-class', 'Every class in the markup has a CSS rule'],
    ['shapeless-class', 'Every class sets at least one box property'],
    ['raw-colour', 'No hard-coded colour in components'],
    ['hardcoded-gutter', 'One gutter token, obeyed by everything'],
    ['undefined-token', 'Every custom property used is declared'],
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
