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
 *   npm run gallery        write docs/controls.html
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

function forcedFrom(css) {
    const out = [];
    walk(css, []);
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
            const selectors = prelude.split(',').map((s) => s.trim()).filter(Boolean);
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

function cell(spec, state) {
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
    return `<div class="g-cell"><div class="g-state">${state}</div><div class="g-stage${spec.surface ? ' g-surface' : ''}">${el}</div></div>`;
}

const groups = [...new Set(SPECIMENS.map((s) => s.group))];
const body = groups.map((g) => {
    const rows = SPECIMENS.filter((s) => s.group === g).map((s) => `
      <div class="g-row${s.surface ? ' g-wide' : ''}">
        <div class="g-name"><code>${s.name}</code><span>.${s.cls.split(' ').join('.')}</span></div>
        <div class="g-cells">${s.states.map((st) => cell(s, st)).join('')}</div>
      </div>`).join('');
    return `<section class="g-group"><h2>${g}</h2>${rows}</section>`;
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
  @media (max-width: 720px) { .g-row { grid-template-columns: 1fr; } .g-name { padding-top: 0; } }
`;

const css = SHEETS.map(read).join('\n');
const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Controls — every state</title>
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
    <h1>Controls — every state</h1>
    <button class="g-toggle" onclick="document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark'">theme</button>
  </div>
  <p class="g-sub">Generated from the product's own stylesheets and the real <code>Icon</code> component.
     Hover, focus, active and disabled are forced from the product's own rules — a control with no rule for
     a state draws the same as rest, and that is the gap, not a rendering fault. Contract:
     <code>docs/CONTROLS.md</code>. Coverage: <code>npm run states</code>.</p>
${body}
</div>
</body>
</html>
`;

writeFileSync(join(ROOT, 'docs/controls.html'), html);
const cells = SPECIMENS.reduce((n, s) => n + s.states.length, 0);
console.log(`\n  docs/controls.html`);
console.log(`  ${SPECIMENS.length} specimens, ${cells} cells, ${groups.length} groups`);
console.log(`  ${forcedFrom(css).split('\n').filter(Boolean).length} forced-state rules derived from ${SHEETS.length} stylesheets`);
if (MISSING_ICONS.size) console.log(`  MISSING ICONS: ${[...MISSING_ICONS].join(', ')}`);
console.log('');
