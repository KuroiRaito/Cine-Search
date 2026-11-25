#!/usr/bin/env node
/**
 * The state gallery: every control, drawn in every state it owes.
 *
 * `npm run snap` photographs seven screens in their default state. Not one of
 * the three bugs that reached production this month could ever have appeared
 * in it -- the chip needed a filter applied, the heading needed a keyboard,
 * and the score badge was simply never looked at closely. States do not show
 * up in screenshots of pages. They show up in a page built to show them.
 *
 * Two things keep this from drifting away from the product, which is the
 * failure mode of every gallery:
 *
 *   1. The CSS is the product's own, inlined verbatim. Nothing is restated.
 *   2. `:hover`, `:focus-visible`, `:active` and `:disabled` cannot be forced
 *      by markup, so rather than hand-writing what those states look like,
 *      this DERIVES them: every rule in the product that styles one is
 *      duplicated with the pseudo-class swapped for `[data-force~="..."]`.
 *      A control with no rule for a state renders identical to rest, and the
 *      gap is visible rather than inferred.
 *
 * Icons come from the real `Icon` component, through vite-node, so an icon
 * dropped from the role map disappears from the gallery too.
 *
 *   npm run gallery        write docs/as-built.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Icon from '../src/shared/ui/Icon.jsx';
import { SPECIMENS } from './gallery-specimens.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* The real cascade, in the real order. tokens first or nothing resolves. */
const SHEETS = [
    'src/shared/theme/tokens.css',
    'src/app/shell.css',
    'src/shared/ui/ui.css',
    'src/modules/search/search.css',
    'src/modules/title/title.css',
];

/* ---------------------------------------------------------------
   Derive the forced-state rules from the product's own.

   A brace walk rather than a regex: @media and @supports wrap rules
   that must keep their wrapper, and a selector list can run across
   lines. Everything that is not a rule with a dynamic pseudo in it
   is dropped -- this sheet is additive, appended after the real one.
   --------------------------------------------------------------- */
const DYNAMIC = ['hover', 'focus-visible', 'focus-within', 'focus', 'active', 'disabled'];

/* Commas inside `:is(...)`, `:where(...)` and `:not(...)` do NOT separate
   selectors. Splitting on every comma tore the focus rule --
   `:is(a[href], button, …):focus-visible` -- into fragments, left an
   unbalanced bracket on the only one carrying the pseudo-class, and the
   browser dropped the whole thing. The gallery then reported focus as doing
   nothing on a dozen controls, which was the generator's fault and not the
   product's. Depth-aware, and quote-aware for `[href="a,b"]`. */
function splitSelectors(prelude) {
    const out = [];
    let depth = 0, quote = null, cur = '';
    for (const ch of prelude) {
        if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
        cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.filter(Boolean);
}

function forcedFrom(css) {
    const out = [];
    /* Comments first. The walk reads everything between one rule's `}` and the
       next rule's `{` as that rule's selector, so a comment sitting above a
       rule became part of it -- and a selector with prose in it is dropped by
       the browser in silence. It worked by luck wherever a comment's last
       comma happened to fall before the selector, which is the worst kind of
       working: the derived sheet was missing the ONE rule that styles focus
       for every control in the product, and the audit duly reported that focus
       did nothing on a dozen of them. */
    walk(css.replace(/\/\*[\s\S]*?\*\//g, ''), []);
    return out.join('\n');

    function walk(src, wrappers) {
        let i = 0;
        while (i < src.length) {
            const brace = src.indexOf('{', i);
            if (brace < 0) break;
            const prelude = src.slice(i, brace).trim();
            /* find the matching close */
            let depth = 1, j = brace + 1;
            for (; j < src.length && depth; j++) {
                if (src[j] === '{') depth++;
                else if (src[j] === '}') depth--;
            }
            const body = src.slice(brace + 1, j - 1);
            i = j;
            if (prelude.startsWith('@')) {
                /* @media / @supports hold rules; @font-face and friends do not. */
                if (/^@(media|supports|layer|container)/.test(prelude)) walk(body, [...wrappers, prelude]);
                continue;
            }
            const selectors = splitSelectors(prelude);
            const forced = selectors
                .filter((s) => DYNAMIC.some((d) => s.includes(':' + d)))
                .map((s) => {
                    let out = s;
                    for (const d of DYNAMIC) out = out.split(':' + d).join(`[data-force~="${d}"]`);
                    return out;
                });
            if (!forced.length) continue;
            const rule = `${forced.join(', ')} {${body}}`;
            out.push(wrappers.reduceRight((acc, w) => `${w} { ${acc} }`, rule));
        }
    }
}

/* ---------------------------------------------------------------
   Specimens
   --------------------------------------------------------------- */
const icon = (name, size) =>
    renderToStaticMarkup(createElement(Icon, { name, size: size || 16 }));

const MISSING_ICONS = new Set();
function expand(html) {
    return (html || '').replace(/\{icon:([\w-]+)(?::(\d+))?\}/g, (_, name, size) => {
        const svg = icon(name, size ? Number(size) : 16);
        if (!svg) MISSING_ICONS.add(name);
        return svg;
    });
}

function cell(spec, state, labelOverride) {
    const tag = spec.tag || 'button';
    const attrs = { ...(spec.attrs || {}) };
    let cls = spec.cls;
    if (state === 'disabled') attrs.disabled = '';
    if (state === 'selected') {
        /* Both spellings, because the product uses both -- C4. Whichever the
           stylesheet actually selects on is the one that will light up, and
           a control that answers to neither shows as unchanged. */
        attrs['aria-pressed'] = 'true';
        cls += ' on';
    }
    const force = ['hover', 'focus-visible', 'active', 'disabled'].includes(state)
        ? ` data-force="${state}"` : '';
    const a = Object.entries(attrs)
        .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${String(v).replace(/"/g, '&quot;')}"`)).join('');
    const inner = tag === 'input' ? '' : expand(spec.html);
    const el = tag === 'input'
        ? `<input class="${cls}"${force}${a}>`
        : `<${tag} class="${cls}"${force}${a}>${inner}</${tag}>`;
    return `<div class="g-cell"><div class="g-state">${labelOverride || state}</div><div class="g-stage${spec.surface ? ' g-surface' : ''}">${el}</div></div>`;
}

/* ---------------------------------------------------------------
   Foundations, read out of tokens.css rather than restated.

   A swatch sheet that lists colours somebody typed by hand is a
   second source of truth, and the moment the two disagree the
   prettier one wins. So every token below is discovered from the
   file, and every cell paints itself with `var(--name)` -- the
   browser resolves the alias chain, in whichever theme is on. A
   token renamed in tokens.css changes here; a token deleted
   disappears.
   --------------------------------------------------------------- */
const tokensSrc = read('src/shared/theme/tokens.css');

/* The base `:root` block only. The theme blocks below it redefine a
   handful by design, and listing a token twice says nothing extra. */
function rootTokens(src) {
    const start = src.indexOf(':root{');
    let depth = 0, i = start + ':root'.length, end = -1;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && !--depth) { end = i; break; }
    }
    const body = src.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');
    const map = new Map();
    for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) map.set(m[1], m[2].trim());
    return map;
}
const TOKENS = rootTokens(tokensSrc);

/** Follow `var(--a)` to whatever it finally is, so an alias is classified
 *  as the thing it points at. */
function resolve(v, seen = 0) {
    const m = /^var\((--[\w-]+)\)$/.exec((v || '').trim());
    if (!m || seen > 8) return v;
    return resolve(TOKENS.get(m[1]), seen + 1);
}
const isColour = (v) => /^(#|rgb|hsl|oklch|color-mix)/i.test(resolve(v) || '');
const isLength = (v) => /^-?[\d.]+(px|rem|em)$/.test(resolve(v) || '');
const isShadow = (v) => /\dpx .*(rgba?|#)/i.test(resolve(v) || '');

/** Tokens share a family when they share everything but a trailing index. */
const family = (name) => name.replace(/-\d+$/, '');

function foundations() {
    const fams = new Map();
    for (const [name, value] of TOKENS) {
        if (name === '--color-scheme') continue;
        const f = family(name);
        if (!fams.has(f)) fams.set(f, []);
        fams.get(f).push({ name, value });
    }
    const chunk = (title, test, render) => {
        const rows = [...fams].filter(([, items]) => items.some((t) => test(t.value)));
        if (!rows.length) return '';
        return `<section class="g-group"><h2>${title}</h2>` + rows.map(([f, items]) => `
      <div class="g-row g-wide">
        <div class="g-name"><code>${f}-*</code><span>${items.length} token${items.length > 1 ? 's' : ''}</span></div>
        <div class="g-cells g-tokens">${items.map(render).join('')}</div>
      </div>`).join('') + '</section>';
    };

    const swatch = (t) => `<div class="g-tok">
        <div class="g-chip" style="background:var(${t.name})"></div>
        <code>${t.name.replace('--', '')}</code></div>`;
    const bar = (t) => `<div class="g-tok">
        <div class="g-bar" style="width:var(${t.name});min-width:1px"></div>
        <code>${t.name.replace('--', '')}</code><span>${resolve(t.value)}</span></div>`;
    const shade = (t) => `<div class="g-tok g-tok-wide">
        <div class="g-shadowbox" style="box-shadow:var(${t.name})"></div>
        <code>${t.name.replace('--', '')}</code></div>`;
    const plain = (t) => `<div class="g-tok g-tok-wide">
        <code>${t.name.replace('--', '')}</code><span>${resolve(t.value)}</span></div>`;

    return [
        chunk('Foundations — colour', isColour, swatch),
        chunk('Foundations — length', (v) => isLength(v) && !isColour(v), bar),
        chunk('Foundations — elevation', isShadow, shade),
        chunk('Foundations — motion and the rest',
            (v) => !isColour(v) && !isLength(v) && !isShadow(v), plain),
    ].join('\n');
}

/* ---------------------------------------------------------------
   Every icon the set actually has, drawn by the real component.
   The role list is read out of Icon.jsx's own map, so a role added
   there appears here and a role removed disappears -- which is the
   check `verify` 16 makes statically, made visible.
   --------------------------------------------------------------- */
function iconSheet() {
    const src = read('src/shared/ui/Icon.jsx');
    const body = src.match(/const\s+ICONS\s*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? '';
    const roles = [...body.matchAll(/(?:^|[,{\s])([a-zA-Z][\w-]*)\s*:/g)].map((m) => m[1]);
    const cells = [...new Set(roles)].map((r) => `<div class="g-tok">
        <div class="g-iconbox">${icon(r, 24)}</div><code>${r}</code></div>`).join('');
    return `<section class="g-group"><h2>Icons — ${new Set(roles).size} roles</h2>
      <div class="g-row g-wide">
        <div class="g-name"><code>Icon</code><span>src/shared/ui/Icon.jsx</span></div>
        <div class="g-cells g-tokens">${cells}</div>
      </div></section>`;
}

const groups = [...new Set(SPECIMENS.map((s) => s.group))];
const body = groups.map((g) => {
    const mine = SPECIMENS.filter((s) => s.group === g);
    /* Specimens sharing a `row` are drawn side by side, labelled by name
       instead of by state. Six watch-state hues stacked one per row prove
       nothing: the only way to know six colours are telling apart is to see
       them next to each other, in both themes. */
    const rows = [];
    const done = new Set();
    for (const s of mine) {
        if (s.row) {
            if (done.has(s.row)) continue;
            done.add(s.row);
            const band = mine.filter((x) => x.row === s.row);
            rows.push(`
      <div class="g-row">
        <div class="g-name"><code>${s.row}</code><span>${band.length} together</span></div>
        <div class="g-cells">${band.map((x) => cell(x, x.states[0], x.name)).join('')}</div>
      </div>`);
            continue;
        }
        rows.push(`
      <div class="g-row${s.surface ? ' g-wide' : ''}">
        <div class="g-name"><code>${s.name}</code><span>.${s.cls.split(' ').join('.')}</span></div>
        <div class="g-cells">${s.states.map((st) => cell(s, st)).join('')}</div>
      </div>`);
    }
    return `<section class="g-group"><h2>${g}</h2>${rows.join('')}</section>`;
}).join('\n');

const CHROME = `
  .g-wrap { padding: 24px; max-width: 1180px; margin: 0 auto; }
  .g-top { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 4px; }
  .g-top h1 { font-size: 22px; }
  .g-sub { color: var(--muted); font-size: 13px; line-height: 1.5; max-width: 62ch; margin-bottom: 24px; }
  .g-group { margin-bottom: 36px; }
  .g-group h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted);
                border-bottom: 1px solid var(--bd-sub); padding-bottom: 8px; margin-bottom: 4px; }
  .g-row { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 16px; align-items: start;
           padding: 14px 0; border-bottom: 1px solid var(--bd-sub); }
  .g-name { font-size: 12px; padding-top: 22px; }
  .g-name code { font-family: var(--f-m); color: var(--text); display: block; }
  .g-name span { color: var(--faint); font-family: var(--f-m); font-size: 11px; }
  .g-cells { display: flex; flex-wrap: wrap; gap: 10px; }
  .g-cell { min-width: 104px; }
  .g-state { font-family: var(--f-m); font-size: 10px; letter-spacing: .04em; color: var(--faint);
             text-transform: uppercase; margin-bottom: 6px; }
  /* A dashed box, so a control with no rule for a state is obviously the same
     as rest rather than merely looking fine. */
  /* \`contain: layout\` makes the stage a containing block for a
     position:fixed descendant, so \`.toast\` is drawn here rather than
     floating over the page. Nothing in the product CSS is overridden to
     achieve it -- the specimen is still the real rule. */
  .g-stage { border: 1px dashed var(--bd-sub); border-radius: 8px; padding: 12px;
             display: flex; align-items: center; justify-content: center; min-height: 64px;
             position: relative; contain: layout; }
  .g-stage.g-surface { display: block; }
  .g-row.g-wide { grid-template-columns: 190px minmax(0, 1fr); }
  .g-row.g-wide .g-cell { min-width: min(520px, 100%); flex: 1 1 100%; }
  .g-toggle { font-family: var(--f-m); font-size: 12px; cursor: pointer; background: var(--surface);
              color: var(--text); border: 1px solid var(--bd); border-radius: 999px; padding: 6px 14px; }
  .g-tokens { gap: 10px 14px; }
  .g-tok { display: flex; flex-direction: column; gap: 4px; width: 92px; font-family: var(--f-m); font-size: 10px; }
  .g-tok-wide { width: auto; min-width: 150px; }
  .g-tok code { color: var(--text); word-break: break-all; }
  .g-tok span { color: var(--faint); }
  .g-chip { height: 40px; border-radius: 6px; border: 1px solid var(--bd-sub); }
  .g-bar { height: 12px; background: var(--acc); border-radius: 2px; }
  .g-shadowbox { height: 40px; width: 120px; border-radius: 10px; background: var(--raised); }
  .g-iconbox { height: 44px; display: flex; align-items: center; justify-content: center;
               border: 1px dashed var(--bd-sub); border-radius: 8px; color: var(--text); }
  @media (max-width: 720px) { .g-row { grid-template-columns: 1fr; } .g-name { padding-top: 0; } }
`;

const css = SHEETS.map(read).join('\n');
const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The product, as built</title>
<!-- GENERATED by scripts/gallery.mjs. Do not edit: run \`npm run gallery\`.
     The stylesheets below are the product's own, inlined verbatim, followed by
     forced-state duplicates derived from them. -->
<style>${css}</style>
<style>/* derived forced states */
${forcedFrom(css)}
</style>
<style>${CHROME}</style>
</head>
<body>
<div class="g-wrap">
  <div class="g-top">
    <h1>The product, as built</h1>
    <button class="g-toggle" onclick="document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark'">theme</button>
  </div>
  <p class="g-sub">Every token, icon and component the product actually renders, generated from its own
     stylesheets and components — not a drawing of them. The eight <code>docs/*.html</code> design documents say
     what was <em>designed</em>; this says what the code <em>produces</em>, and the gap between the two is drift.
     Hover, focus, active and disabled are derived from the product's own rules, so a control with no rule for a
     state draws the same as rest — that is the gap, not a rendering fault.
     Contract: <code>docs/CONTROLS.md</code>. Coverage: <code>npm run states</code>. Dead states:
     <code>npm run gallery:audit</code>.</p>
${foundations()}
${iconSheet()}
${body}
</div>
</body>
</html>
`;

writeFileSync(join(ROOT, 'docs/as-built.html'), html);
const cells = SPECIMENS.reduce((n, s) => n + s.states.length, 0);
console.log(`\n  docs/as-built.html`);
console.log(`  ${SPECIMENS.length} specimens, ${cells} cells, ${groups.length} component groups`);
console.log(`  ${TOKENS.size} tokens read from tokens.css, grouped into families`);
console.log(`  ${forcedFrom(css).split('\n').filter(Boolean).length} forced-state rules derived from ${SHEETS.length} stylesheets`);
if (MISSING_ICONS.size) console.log(`  MISSING ICONS: ${[...MISSING_ICONS].join(', ')}`);
console.log('');
