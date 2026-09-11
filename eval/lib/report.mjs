// Console report + run persistence + regression surfacing.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'runs');

const C = { dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
            bold: '\x1b[1m', reset: '\x1b[0m' };

const pct = (f) => f == null || f.pct == null ? '  —  ' : `${(f.pct * 100).toFixed(0).padStart(3)}%`;
const fr  = (f) => f == null ? '     ' : `${f.n}/${f.d}`;
const num = (v, d = 2) => v == null ? '  —  ' : v.toFixed(d);
const pad = (s, n) => String(s).padEnd(n);

export function printReport(run, prev = null) {
    const { aggregate: agg, categories, config } = run;

    console.log(`\n${C.bold}CINE SEARCH — EVAL RUN${C.reset}`);
    console.log(`${C.dim}variant: ${config.variant}  |  ${run.run_id}`);
    console.log(`cache: ${(run.cache.hitRate * 100).toFixed(0)}% hit (${run.cache.total} requests)${C.reset}\n`);

    // ---- headline ----
    console.log(`${C.bold}HEADLINE${C.reset}`);
    console.log(`  null-and-low@5   ${C.bold}${pct(agg.nullAndLow5)}${C.reset}  ${C.dim}(${fr(agg.nullAndLow5)})  nothing useful in top 5${C.reset}`);
    console.log(`    ├ zero results        ${pct(agg.zeroResult)}  ${C.dim}(${fr(agg.zeroResult)})${C.reset}`);
    console.log(`    └ populated but wrong ${pct(agg.populatedButWrong)}  ${C.dim}(${fr(agg.populatedButWrong)})${C.reset}`);
    console.log(`  NDCG@10          ${C.bold}${num(agg.ndcg10)}${C.reset}  ${C.dim}graded, position-aware, comparable across query types${C.reset}`);
    console.log(`  MRR (known-item)  ${num(agg.mrr)}   P@5 (open-set) ${num(agg.precision5)}   coverage@10 ${num(agg.coverage10)}`);
    console.log(`  catalogue gaps    ${pct(agg.catalogueGap)} ${C.dim}(${fr(agg.catalogueGap)}) excluded from scoring${C.reset}\n`);

    // ---- per category ----
    console.log(`${C.bold}BY CATEGORY${C.reset}  ${C.dim}(lower null-and-low is better)${C.reset}`);
    console.log(`${C.dim}  ${pad('category', 22)} ${pad('n&l@5', 12)} ${pad('zero', 11)} ${pad('NDCG@10', 8)} ${pad('MRR', 6)} ${pad('P@5', 6)}${C.reset}`);

    const rows = Object.entries(categories).sort((a, b) => (b[1].nullAndLow5.pct ?? 0) - (a[1].nullAndLow5.pct ?? 0));
    for (const [cat, a] of rows) {
        const flag = a.directionalOnly ? `${C.yellow}~${C.reset}` : ' ';
        const sev = (a.nullAndLow5.pct ?? 0) >= 0.5 ? C.red : (a.nullAndLow5.pct ?? 0) >= 0.25 ? C.yellow : C.green;
        console.log(`${flag} ${pad(cat, 22)} ${sev}${pct(a.nullAndLow5)}${C.reset} ${pad(C.dim + fr(a.nullAndLow5) + C.reset, 16)} ${pad(pct(a.zeroResult), 11)} ${pad(num(a.ndcg10), 8)} ${pad(num(a.mrr), 6)} ${pad(num(a.precision5), 6)}`);
    }
    console.log(`${C.dim}  ~ = fewer than 15 scored queries; directional only, do not present as a result${C.reset}`);

    if (prev) printDiff(run, prev);
    console.log();
}

/**
 * Regressions are the most valuable output of this harness, so they are printed
 * last, in red, and never averaged away into the headline.
 */
function printDiff(run, prev) {
    console.log(`\n${C.bold}VS ${prev.config.variant} (${prev.run_id.slice(0, 10)})${C.reset}`);

    const d = (run.aggregate.nullAndLow5.pct ?? 0) - (prev.aggregate.nullAndLow5.pct ?? 0);
    const arrow = d < 0 ? `${C.green}▼ ${(Math.abs(d) * 100).toFixed(1)}pp better` : d > 0 ? `${C.red}▲ ${(d * 100).toFixed(1)}pp WORSE` : `${C.dim}no change`;
    console.log(`  null-and-low@5: ${pct(prev.aggregate.nullAndLow5)} → ${pct(run.aggregate.nullAndLow5)}   ${arrow}${C.reset}\n`);

    const regressions = [], improvements = [];
    for (const [cat, a] of Object.entries(run.categories)) {
        const p = prev.categories[cat];
        if (!p) continue;
        const delta = (a.nullAndLow5.pct ?? 0) - (p.nullAndLow5.pct ?? 0);
        if (Math.abs(delta) < 0.001) continue;
        const line = `${pad(cat, 22)} ${pct(p.nullAndLow5)} → ${pct(a.nullAndLow5)}  (${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}pp)${a.directionalOnly ? `  ${C.yellow}[small n]${C.reset}` : ''}`;
        (delta > 0 ? regressions : improvements).push(line);
    }

    if (improvements.length) {
        console.log(`  ${C.green}IMPROVED${C.reset}`);
        improvements.forEach(l => console.log(`    ${C.green}✓${C.reset} ${l}`));
    }
    if (regressions.length) {
        console.log(`\n  ${C.red}${C.bold}⚠  REGRESSIONS — ${regressions.length} categor${regressions.length === 1 ? 'y' : 'ies'} got worse${C.reset}`);
        regressions.forEach(l => console.log(`    ${C.red}⚠${C.reset} ${l}`));
        console.log(`  ${C.dim}Do not ship past these silently. Explain each one in the PRD.${C.reset}`);
    } else {
        console.log(`\n  ${C.dim}No category regressed.${C.reset}`);
    }
}

export function saveRun(run) {
    if (!existsSync(RUNS_DIR)) mkdirSync(RUNS_DIR, { recursive: true });
    const file = join(RUNS_DIR, `${run.run_id.replace(/[:.]/g, '-')}__${run.config.variant}.json`);
    writeFileSync(file, JSON.stringify(run, null, 2));
    return file;
}

export function loadPreviousRun(variant = null) {
    if (!existsSync(RUNS_DIR)) return null;
    const files = readdirSync(RUNS_DIR).filter(f => f.endsWith('.json'))
        .filter(f => !variant || f.includes(`__${variant}.json`)).sort();
    if (!files.length) return null;
    return JSON.parse(readFileSync(join(RUNS_DIR, files[files.length - 1]), 'utf8'));
}
