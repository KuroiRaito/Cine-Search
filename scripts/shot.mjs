#!/usr/bin/env node
/**
 * One control, photographed in every state it owes.
 *
 * The gallery is 18,000px tall. When the question is "what does the score
 * badge look like now", scrolling to it and squinting is the wrong tool —
 * and squinting at small controls is exactly what missed a 16px star sitting
 * on 11px digits for months.
 *
 * This pulls single rows out of the gallery at 3x and writes them as files,
 * so a control can be looked at the size a decision needs rather than the
 * size it ships at.
 *
 *   npm run shot -- tile quickadd            two rows, dark
 *   npm run shot -- --light tile             the same row in light
 *   npm run shot -- --list                   every row name available
 *
 * Names are the gallery's own, which are the class names. A name with a
 * space needs quoting: npm run shot -- "toast, after a remove"
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/shots');
const PAGE = join(ROOT, 'docs/as-built.html');

const args = process.argv.slice(2);
const light = args.includes('--light');
const list = args.includes('--list');
const want = args.filter((a) => !a.startsWith('--'));

if (!list && !want.length) {
    console.error('\n  usage: npm run shot -- <control> [control...]  [--light]');
    console.error('         npm run shot -- --list\n');
    process.exit(2);
}

let html;
try {
    html = readFileSync(PAGE, 'utf8');
} catch {
    console.error('\n  docs/as-built.html is not there. Run `npm run gallery` first.\n');
    process.exit(2);
}

const server = createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));

const browser = await chromium.launch();
/* 3x because the decisions these answer are about stroke weight and optical
   centring, which do not survive a 1x screenshot of a 24px control. */
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 3 });
await page.goto(`http://127.0.0.1:${server.address().port}/`);
if (light) await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
/* A transition caught mid-flight is not the state it is labelled as. */
await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });

const rows = await page.$$('.g-row');
const names = [];
for (const row of rows) {
    const name = await row.$eval('.g-name code', (e) => e.textContent).catch(() => null);
    names.push({ row, name });
}

if (list) {
    console.log('\n  rows in the gallery\n');
    for (const { name } of names) if (name) console.log('   ', name);
    console.log(`\n  ${names.filter((n) => n.name).length} rows.\n`);
} else {
    mkdirSync(OUT, { recursive: true });
    const theme = light ? 'light' : 'dark';
    let n = 0;
    for (const { row, name } of names) {
        if (!name || !want.includes(name)) continue;
        const file = join(OUT, `${name.replace(/[^a-z0-9]+/gi, '-')}.${theme}.png`);
        await row.screenshot({ path: file });
        console.log('  ', file.replace(ROOT, ''));
        n++;
    }
    const missed = want.filter((w) => !names.some((x) => x.name === w));
    if (missed.length) console.log(`\n  no such row: ${missed.join(', ')}  (try --list)`);
    console.log(`\n  ${n} written to docs/shots/\n`);
}

await browser.close();
server.close();
